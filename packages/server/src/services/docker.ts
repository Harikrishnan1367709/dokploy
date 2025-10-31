import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";

export const getContainers = async (serverId?: string | null) => {
	try {
		const command =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | Image: {{.Image}} | Ports: {{.Ports}} | State: {{.State}} | Status: {{.Status}}'";
		let stdout = "";
		let stderr = "";

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);

			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}
		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const lines = stdout.trim().split("\n");

		const containers = lines
			.map((line) => {
				const parts = line.split(" | ");
				const containerId = parts[0]
					? parts[0].replace("CONTAINER ID : ", "").trim()
					: "No container id";
				const name = parts[1]
					? parts[1].replace("Name: ", "").trim()
					: "No container name";
				const image = parts[2]
					? parts[2].replace("Image: ", "").trim()
					: "No image";
				const ports = parts[3]
					? parts[3].replace("Ports: ", "").trim()
					: "No ports";
				const state = parts[4]
					? parts[4].replace("State: ", "").trim()
					: "No state";
				const status = parts[5]
					? parts[5].replace("Status: ", "").trim()
					: "No status";
				return {
					containerId,
					name,
					image,
					ports,
					state,
					status,
					serverId,
				};
			})
			.filter(
				(container) =>
					!container.name.includes("dokploy") ||
					container.name.includes("dokploy-monitoring"),
			);

		return containers;
	} catch (error) {
		console.error(error);

		return [];
	}
};

export const getConfig = async (
	containerId: string,
	serverId?: string | null,
) => {
	try {
		const command = `docker inspect ${containerId} --format='{{json .}}'`;
		let stdout = "";
		let stderr = "";
		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const config = JSON.parse(stdout);

		return config;
	} catch {}
};

export const getContainersByAppNameMatch = async (
	appName: string,
	appType?: "stack" | "docker-compose",
	serverId?: string,
) => {
	try {
		let result: string[] = [];
		const cmd =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'";

		const command =
			appType === "docker-compose"
				? `${cmd} --filter='label=com.docker.compose.project=${appName}'`
				: `${cmd} | grep '^.*Name: ${appName}'`;
		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";
			return {
				containerId,
				name,
				state,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getStackContainersByAppName = async (
	appName: string,
	serverId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker stack ps ${appName} --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}}'`;
		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";
			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";
			return {
				containerId,
				name,
				state,
				node,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getServiceContainersByAppName = async (
	appName: string,
	serverId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker service ps ${appName} --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}}'`;

		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";

			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";
			return {
				containerId,
				name,
				state,
				node,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getContainersByAppLabel = async (
	appName: string,
	type: "standalone" | "swarm",
	serverId?: string,
) => {
	try {
		let stdout = "";
		let stderr = "";
		let command = "";

		// Build command based on type
		if (type === "swarm") {
			command = `docker ps --filter "label=com.docker.swarm.service.name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
		} else if (type === "standalone") {
			command = `docker ps --filter "name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
		} else {
			command = `docker ps --filter "label=com.docker.compose.project=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
		}

		// Execute command
		let result;
		if (serverId) {
			result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			// Don't return early, try fallback
		}

		// If no results and type is standalone, try alternative search patterns
		if ((!stdout || stdout.trim() === "") && type === "standalone") {
			// Try exact name match
			command = `docker ps --filter "name=^${appName}$" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
			
			if (serverId) {
				result = await execAsyncRemote(serverId, command);
				stdout = result.stdout;
				stderr = result.stderr;
			} else {
				result = await execAsync(command);
				stdout = result.stdout;
				stderr = result.stderr;
			}

			// If still no results, try searching all running containers and filter by name containing appName
			if (!stdout || stdout.trim() === "") {
				command = `docker ps --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
				
				if (serverId) {
					result = await execAsyncRemote(serverId, command);
					stdout = result.stdout;
				} else {
					result = await execAsync(command);
					stdout = result.stdout;
				}

				// Filter results to containers whose name contains appName
				if (stdout) {
					const allLines = stdout.trim().split("\n");
					const filteredLines = allLines.filter((line) => {
						const parts = line.split(" | ");
						const name = parts[1]?.replace("Name: ", "").trim() || "";
						return name.toLowerCase().includes(appName.toLowerCase());
					});
					stdout = filteredLines.join("\n");
				}
			}
		}

		if (!stdout || stdout.trim() === "") {
			return [];
		}

		const lines = stdout.trim().split("\n");

		const containers = lines.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";
			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";
			return {
				containerId,
				name,
				state,
			};
		});

		return containers || [];
	} catch (error) {
		console.error(`Error getting containers for ${appName}:`, error);
		return [];
	}
};

export const containerRestart = async (containerId: string) => {
	try {
		const { stdout, stderr } = await execAsync(
			`docker container restart ${containerId}`,
		);

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const config = JSON.parse(stdout);

		return config;
	} catch {}
};

export const getSwarmNodes = async (serverId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = "docker node ls --format '{{json .}}'";

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const nodesArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		return nodesArray;
	} catch {}
};

export const getNodeInfo = async (nodeId: string, serverId?: string) => {
	try {
		const command = `docker node inspect ${nodeId} --format '{{json .}}'`;
		let stdout = "";
		let stderr = "";
		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const nodeInfo = JSON.parse(stdout);

		return nodeInfo;
	} catch {}
};

export const getNodeApplications = async (serverId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ls --format '{{json .}}'`;

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);

			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const appArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line))
			.filter((service) => !service.Name.startsWith("dokploy-"));

		return appArray;
	} catch {}
};

export const getApplicationInfo = async (
	appNames: string[],
	serverId?: string,
) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ps ${appNames.join(" ")} --format '{{json .}}' --no-trunc`;

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const appArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		return appArray;
	} catch {}
};
