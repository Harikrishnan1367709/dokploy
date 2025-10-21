import { Hono } from "hono";
import { logger } from "./logger.js";

const app = new Hono();

// Simple release check function that doesn't depend on complex server imports
async function checkForNewReleases() {
  try {
    logger.info("🔄 Checking for new releases...");
    
    // Fetch latest release from GitHub
    const response = await fetch("https://api.github.com/repos/Dokploy/dokploy/releases/latest");
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const release = await response.json();
    const latestVersion = release.tag_name.replace('v', '');
    const currentVersion = "0.25.4"; // Current Dokploy version
    
    logger.info(`📦 Latest version: ${latestVersion}, Current version: ${currentVersion}`);
    
    // Simple version comparison
    if (latestVersion !== currentVersion) {
      logger.info(`🎉 New release found: ${latestVersion}`);
      // Here you would send notifications
      return true;
    } else {
      logger.info("✅ No new releases found");
      return false;
    }
  } catch (error) {
    logger.error("❌ Error checking for releases:", error);
    return false;
  }
}

// Schedule the release check
app.get("/", async (c) => {
  await checkForNewReleases();
  return c.text("Release check completed");
});

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

export default app;
