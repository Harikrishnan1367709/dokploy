import { promises } from "node:fs";
import osUtils from "node-os-utils";
import { paths } from "../constants";
import { execAsync } from "../utils/process/execAsync";

export interface Container {
	BlockIO: string;
	CPUPerc: string;
	Container: string;
	ID: string;
	MemPerc: string;
	MemUsage: string;
	Name: string;
	NetIO: string;
}
export const recordAdvancedStats = async (
	stats: Container,
	appName: string,
) => {
	const { MONITORING_PATH } = paths();
	const path = `${MONITORING_PATH}/${appName}`;

	await promises.mkdir(path, { recursive: true });

	await updateStatsFile(appName, "cpu", stats.CPUPerc);
	
	// Parse memory usage - format is typically "used / total" (e.g., "100MiB / 2GiB")
	const memParts = stats.MemUsage.split(" / ");
	let memUsed = memParts[0]?.trim() || "0";
	let memTotal = memParts[1]?.trim() || "0";
	
	// For dokploy server, if limit is 0, unavailable, or empty, use host system memory
	if (appName === "dokploy" && (!memTotal || memTotal === "0" || memTotal === "" || memTotal === "0B")) {
		try {
			const mem = await osUtils.mem.info();
			// Convert host memory to GiB format for consistency with Docker stats output
			const totalGB = mem.totalMemMb / 1024;
			memTotal = `${totalGB.toFixed(2)}GiB`;
		} catch (error) {
			console.error("Failed to get host memory info for dokploy:", error);
			// If host memory fetch fails, keep the original value (might be valid)
		}
	}
	
	await updateStatsFile(appName, "memory", {
		used: memUsed,
		total: memTotal,
	});

	await updateStatsFile(appName, "block", {
		readMb: stats.BlockIO.split(" ")[0],
		writeMb: stats.BlockIO.split(" ")[2],
	});

	await updateStatsFile(appName, "network", {
		inputMb: stats.NetIO.split(" ")[0],
		outputMb: stats.NetIO.split(" ")[2],
	});

	if (appName === "dokploy") {
		try {
			let diskUsage = 0;
			let diskTotal = 0;
			let diskUsedPercentage = 0;
			let diskFree = 0;

			// First try osUtils method
			try {
				const disk = await osUtils.drive.info("/");
				diskUsage = Number(disk.usedGb) || 0;
				diskTotal = Number(disk.totalGb) || 0;
				diskUsedPercentage = Number(disk.usedPercentage) || 0;
				diskFree = Number(disk.freeGb) || 0;
			} catch (osUtilsError) {
				console.warn("osUtils drive.info failed, trying df command:", osUtilsError);
			}

			// Fallback to df command if osUtils didn't work or returned 0
			if (diskTotal === 0) {
				try {
					// Use df command to get disk info in 1KB blocks
					const { stdout } = await execAsync("df -k / | tail -n 1");
					const parts = stdout.trim().split(/\s+/);
					
					if (parts.length >= 4) {
						// df output: Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
						const totalKB = parseInt(parts[1], 10);
						const usedKB = parseInt(parts[2], 10);
						const availableKB = parseInt(parts[3], 10);
						
						if (!isNaN(totalKB) && totalKB > 0) {
							diskTotal = totalKB / (1024 * 1024); // Convert KB to GB
							diskUsage = usedKB / (1024 * 1024); // Convert KB to GB
							diskFree = availableKB / (1024 * 1024); // Convert KB to GB
							diskUsedPercentage = (diskUsage / diskTotal) * 100;
						}
					}
				} catch (dfError) {
					console.error("df command also failed:", dfError);
				}
			}

			// Only update if we have valid data
			if (diskTotal > 0) {
				await updateStatsFile(appName, "disk", {
					diskTotal: diskTotal,
					diskUsedPercentage: diskUsedPercentage,
					diskUsage: diskUsage,
					diskFree: diskFree,
				});
			} else {
				console.error("Failed to get disk info for dokploy - all methods failed");
				// Don't update with 0 values, let previous values persist
			}
		} catch (error) {
			console.error("Failed to get disk info for dokploy:", error);
			// If disk info collection fails, the previous values will persist
			// This prevents showing 0 if there's a temporary issue
		}
	}
};

export const getAdvancedStats = async (appName: string) => {
	return {
		cpu: await readStatsFile(appName, "cpu"),
		memory: await readStatsFile(appName, "memory"),
		disk: await readStatsFile(appName, "disk"),
		network: await readStatsFile(appName, "network"),
		block: await readStatsFile(appName, "block"),
	};
};

export const readStatsFile = async (
	appName: string,
	statType: "cpu" | "memory" | "disk" | "network" | "block",
) => {
	try {
		const { MONITORING_PATH } = paths();
		const filePath = `${MONITORING_PATH}/${appName}/${statType}.json`;
		const data = await promises.readFile(filePath, "utf-8");
		return JSON.parse(data);
	} catch {
		return [];
	}
};

export const updateStatsFile = async (
	appName: string,
	statType: "cpu" | "memory" | "disk" | "network" | "block",
	value: number | string | unknown,
) => {
	const { MONITORING_PATH } = paths();
	const stats = await readStatsFile(appName, statType);
	stats.push({ value, time: new Date() });

	if (stats.length > 288) {
		stats.shift();
	}

	const content = JSON.stringify(stats);
	await promises.writeFile(
		`${MONITORING_PATH}/${appName}/${statType}.json`,
		content,
	);
};

export const readLastValueStatsFile = async (
	appName: string,
	statType: "cpu" | "memory" | "disk" | "network" | "block",
) => {
	try {
		const { MONITORING_PATH } = paths();
		const filePath = `${MONITORING_PATH}/${appName}/${statType}.json`;
		const data = await promises.readFile(filePath, "utf-8");
		const stats = JSON.parse(data);
		return stats[stats.length - 1] || null;
	} catch {
		return null;
	}
};

export const getLastAdvancedStatsFile = async (appName: string) => {
	return {
		cpu: await readLastValueStatsFile(appName, "cpu"),
		memory: await readLastValueStatsFile(appName, "memory"),
		disk: await readLastValueStatsFile(appName, "disk"),
		network: await readLastValueStatsFile(appName, "network"),
		block: await readLastValueStatsFile(appName, "block"),
	};
};
