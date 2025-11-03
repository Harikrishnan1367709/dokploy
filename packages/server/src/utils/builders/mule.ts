import { createWriteStream } from "node:fs";
import * as pathModule from "node:path";
import type { CreateServiceOptions } from "dockerode";
import { paths } from "@dokploy/server/constants";
import type { ApplicationNested } from "./index";
import {
	calculateResources,
	generateBindMounts,
	generateConfigContainer,
	generateFileMounts,
	generateVolumeMounts,
	prepareEnvironmentVariables,
	getServiceContainer,
	pullImage,
	pullRemoteImage,
} from "../docker/utils";
import { getRemoteDocker } from "../servers/remote-docker";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import fs from "node:fs/promises";

const MULE_IMAGE = "hari1367709/mule-community1:4.9.0";
const MULE_APPS_PATH = "/opt/mule-standalone/apps";

const copyJarToContainer = async (
	application: ApplicationNested,
	jarPath: string,
	jarFileName: string,
	writeStream: NodeJS.WritableStream,
) => {
	const { appName, serverId } = application;

	// First, wait for the service task to be running
	writeStream.write(`Waiting for Docker Swarm service task to start...\n`);
	const maxTaskRetries = 30;
	const taskRetryDelay = 2000; // 2 seconds
	
	let taskRunning = false;
	for (let attempt = 1; attempt <= maxTaskRetries; attempt++) {
		// Check service task status
		let taskStatus = "";
		if (serverId) {
			const { stdout } = await execAsyncRemote(
				serverId,
				`docker service ps ${appName} --no-trunc --format '{{.CurrentState}}' 2>/dev/null | head -n 1`,
			);
			taskStatus = stdout.trim().toLowerCase();
		} else {
			const { stdout } = await execAsync(
				`docker service ps ${appName} --no-trunc --format '{{.CurrentState}}' 2>/dev/null | head -n 1`,
			);
			taskStatus = stdout.trim().toLowerCase();
		}
		
		if (taskStatus.includes("running")) {
			taskRunning = true;
			writeStream.write(`✅ Service task is running (status: ${taskStatus})\n`);
			break;
		}
		
		writeStream.write(`Service task status: ${taskStatus || "unknown"} (attempt ${attempt}/${maxTaskRetries})...\n`);
		
		if (attempt < maxTaskRetries) {
			await new Promise((resolve) => setTimeout(resolve, taskRetryDelay));
		}
	}
	
	if (!taskRunning) {
		// Get error details
		let errorDetails = "";
		try {
			if (serverId) {
				const { stdout } = await execAsyncRemote(
					serverId,
					`docker service ps ${appName} --no-trunc --format '{{.Error}}' 2>/dev/null | head -n 1`,
				);
				errorDetails = stdout.trim();
			} else {
				const { stdout } = await execAsync(
					`docker service ps ${appName} --no-trunc --format '{{.Error}}' 2>/dev/null | head -n 1`,
				);
				errorDetails = stdout.trim();
			}
		} catch {}
		
		throw new Error(
			`Service task for ${appName} did not reach running state after ${maxTaskRetries} attempts. ${errorDetails ? `Error: ${errorDetails}` : ""}`
		);
	}

	// Now find the container ID from the running task
	writeStream.write(`Finding container from service task...\n`);
	let containerId: string | null = null;
	const maxContainerRetries = 10;
	const containerRetryDelay = 1000; // 1 second

	for (let attempt = 1; attempt <= maxContainerRetries; attempt++) {
		writeStream.write(`Attempting to find container (attempt ${attempt}/${maxContainerRetries})...\n`);
		
		const container = await getServiceContainer(appName, serverId ?? null);
		
		if (container && container.Id) {
			containerId = container.Id;
			writeStream.write(`✅ Found container ID: ${containerId}\n`);
			break;
		}

		if (attempt < maxContainerRetries) {
			writeStream.write(`Container not found yet, waiting ${containerRetryDelay}ms...\n`);
			await new Promise((resolve) => setTimeout(resolve, containerRetryDelay));
		}
	}

	if (!containerId) {
		throw new Error(`Container for ${appName} not found after task is running. This might indicate a Docker Swarm issue.`);
	}

	writeStream.write(`Copying JAR file to container...\n`);

	// Copy JAR file into the container
	const targetPath = `${MULE_APPS_PATH}/${jarFileName}`;

	if (serverId) {
		await execAsyncRemote(
			serverId,
			`docker cp "${jarPath}" ${containerId}:${targetPath}`,
		);
		writeStream.write(`✅ JAR file copied to container\n`);
		
		// Verify the file was copied successfully
		try {
			const { stdout } = await execAsyncRemote(
				serverId,
				`docker exec ${containerId} ls -lh ${targetPath} 2>/dev/null || echo "File not found"`,
			);
			if (stdout.includes("File not found")) {
				writeStream.write(`⚠️  Warning: Could not verify file exists in container\n`);
			} else {
				writeStream.write(`✅ Verified: ${stdout.trim()}\n`);
			}
		} catch {
			writeStream.write(`ℹ️  Could not verify file (proceeding anyway)\n`);
		}
	} else {
		await execAsync(`docker cp "${jarPath}" ${containerId}:${targetPath}`);
		writeStream.write(`✅ JAR file copied to container\n`);
		
		// Verify the file was copied successfully
		try {
			const { stdout } = await execAsync(
				`docker exec ${containerId} ls -lh ${targetPath} 2>/dev/null || echo "File not found"`,
			);
			if (stdout.includes("File not found")) {
				writeStream.write(`⚠️  Warning: Could not verify file exists in container\n`);
			} else {
				writeStream.write(`✅ Verified: ${stdout.trim()}\n`);
			}
		} catch {
			writeStream.write(`ℹ️  Could not verify file (proceeding anyway)\n`);
		}
	}

	writeStream.write(`\n✅ JAR file deployed to ${targetPath}\n`);
	writeStream.write(`ℹ️  Mule runtime will automatically detect and deploy the JAR file\n`);
	writeStream.write(`ℹ️  The application should be available shortly at the configured ports\n`);
};

export const buildMule = async (
	application: ApplicationNested,
	logPath: string,
): Promise<void> => {
	const writeStream = createWriteStream(logPath, { flags: "a" });

	try {
		writeStream.write("\n=== Mule Runtime Deployment ===\n");
		writeStream.write(`Image: ${MULE_IMAGE}\n`);

		const { appName, serverId } = application;

		// Find JAR file in the code directory
		const { APPLICATIONS_PATH } = paths(!!serverId);
		const codePath = pathModule.join(APPLICATIONS_PATH, appName, "code");
		
		let jarPath: string;
		let jarFileName: string;

		if (serverId) {
			// Find JAR file remotely
			const { stdout: jarFiles } = await execAsyncRemote(
				serverId,
				`find "${codePath}" -maxdepth 1 -name "*.jar" -type f 2>/dev/null | head -n 1`,
			);
			const foundJar = jarFiles.trim();
			if (!foundJar) {
				throw new Error(`No JAR file found in ${codePath}`);
			}
			jarPath = foundJar;
			jarFileName = pathModule.basename(jarPath);
		} else {
			// Find JAR file locally
			const files = await fs.readdir(codePath);
			const jarFiles = files.filter((f): f is string => f.endsWith(".jar"));
			if (jarFiles.length === 0) {
				throw new Error(`No JAR file found in ${codePath}`);
			}
			// Safe to access [0] after length check
			jarFileName = jarFiles[0]!;
			jarPath = pathModule.join(codePath, jarFileName);
		}

		writeStream.write(`✅ JAR file found: ${jarFileName}\n`);
		writeStream.write(`JAR path: ${jarPath}\n`);

		// Pull Mule image
		writeStream.write(`Pulling ${MULE_IMAGE}...\n`);
		if (serverId) {
			await pullRemoteImage(
				MULE_IMAGE,
				serverId,
				(data) => {
					if (writeStream.writable) {
						writeStream.write(`${JSON.stringify(data)}\n`);
					}
				},
			);
		} else {
			await pullImage(
				MULE_IMAGE,
				(data) => {
					if (writeStream.writable) {
						writeStream.write(`${data}\n`);
					}
				},
			);
		}
		writeStream.write(`✅ Image pulled successfully\n`);

		// Setup ports - Mule uses 8081 and 1099
		const mulePorts = [
			{
				targetPort: 8081,
				publishedPort: 8081,
				protocol: "tcp" as const,
				publishMode: "host" as const,
			},
			{
				targetPort: 1099,
				publishedPort: 1099,
				protocol: "tcp" as const,
				publishMode: "host" as const,
			},
		];

		// Create or update Docker service (without JAR mount)
		await mechanizeMuleContainer(application, mulePorts);

		// Small initial wait to allow service creation
		writeStream.write("Service created, starting deployment check...\n");
		await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 seconds initial wait

		// Copy JAR file directly into the running container
		await copyJarToContainer(
			application,
			jarPath,
			jarFileName,
			writeStream,
		);

		writeStream.write("\n✅ Mule container deployed successfully\n");
		writeStream.write(
			`JAR file copied to ${MULE_APPS_PATH}/${jarFileName} and will be auto-deployed\n`,
		);
	} catch (error) {
		writeStream.write(
			`❌ Error: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		throw error;
	} finally {
		writeStream.end();
	}
};

const mechanizeMuleContainer = async (
	application: ApplicationNested,
	ports: Array<{
		targetPort: number;
		publishedPort: number;
		protocol: "tcp";
		publishMode: "host";
	}>,
) => {
	const {
		appName,
		env,
		mounts,
		cpuLimit,
		memoryLimit,
		memoryReservation,
		cpuReservation,
		command,
		serverId,
	} = application;

	const docker = await getRemoteDocker(serverId);

	// Check if service exists and scale it down to 0 before updating to release ports
	try {
		const service = docker.getService(appName);
		const inspect = await service.inspect();
		
		// Scale down to 0 to release ports
		const currentReplicas = inspect.Spec.Mode?.Replicated?.Replicas || 1;
		if (currentReplicas > 0) {
			await service.update({
				version: Number.parseInt(inspect.Version.Index),
				...inspect.Spec,
				Mode: {
					Replicated: {
						Replicas: 0,
					},
				},
			});
			
			// Wait for tasks to stop (up to 30 seconds)
			for (let i = 0; i < 30; i++) {
				if (serverId) {
					const { stdout } = await execAsyncRemote(
						serverId,
						`docker service ps ${appName} --format '{{.CurrentState}}' --no-trunc 2>/dev/null | head -n 1`,
					);
					const taskState = stdout.trim().toLowerCase();
					if (!taskState || taskState === "shutdown" || taskState === "complete" || taskState === "") {
						break;
					}
				} else {
					const { stdout } = await execAsync(
						`docker service ps ${appName} --format '{{.CurrentState}}' --no-trunc 2>/dev/null | head -n 1`,
					);
					const taskState = stdout.trim().toLowerCase();
					if (!taskState || taskState === "shutdown" || taskState === "complete" || taskState === "") {
						break;
					}
				}
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}
	} catch (error) {
		// Service doesn't exist, that's fine - we'll create it
	}

	const resources = calculateResources({
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
	});

	const volumesMount = generateVolumeMounts(mounts);

	const {
		HealthCheck,
		RestartPolicy,
		Placement,
		Labels,
		Mode,
		RollbackConfig,
		UpdateConfig,
		Networks,
	} = generateConfigContainer(application);

	const bindsMount = generateBindMounts(mounts);
	const filesMount = generateFileMounts(appName, application);
	const envVariables = prepareEnvironmentVariables(
		env,
		application.environment.project.env,
		application.environment.env,
	);

	const settings: CreateServiceOptions = {
		Name: appName,
		TaskTemplate: {
			ContainerSpec: {
				HealthCheck,
				Image: MULE_IMAGE,
				Env: envVariables,
				Mounts: [...volumesMount, ...bindsMount, ...filesMount],
				...(command
					? {
							Command: ["/bin/sh"],
							Args: ["-c", command],
						}
					: {}),
				Labels,
			},
			Networks,
			RestartPolicy,
			Placement,
			Resources: {
				...resources,
			},
		},
		Mode,
		RollbackConfig,
		EndpointSpec: {
			Ports: ports.map((port) => ({
				PublishMode: port.publishMode,
				Protocol: port.protocol,
				TargetPort: port.targetPort,
				PublishedPort: port.publishedPort,
			})),
		},
		UpdateConfig,
	};

	try {
		const service = docker.getService(appName);
		const inspect = await service.inspect();

		await service.update({
			version: Number.parseInt(inspect.Version.Index),
			...settings,
			TaskTemplate: {
				...settings.TaskTemplate,
				ForceUpdate: inspect.Spec.TaskTemplate.ForceUpdate + 1,
			},
		});
	} catch {
		await docker.createService(settings);
	}
};

