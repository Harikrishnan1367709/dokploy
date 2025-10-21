import { db } from "@dokploy/server/db";
import { notifications } from "@dokploy/server/db/schema";
import NewReleaseEmail from "@dokploy/server/emails/emails/new-release";
import { renderAsync } from "@react-email/components";
import { format } from "date-fns";
import { eq } from "drizzle-orm";
import {
	sendDiscordNotification,
	sendEmailNotification,
	sendGotifyNotification,
	sendNtfyNotification,
	sendSlackNotification,
	sendTelegramNotification,
} from "./utils";

interface ReleaseInfo {
	version: string;
	releaseNotes?: string;
	downloadUrl?: string;
	publishedAt: Date;
}

export const sendNewReleaseNotifications = async (releaseInfo: ReleaseInfo) => {
	const { version, releaseNotes, downloadUrl, publishedAt } = releaseInfo;
	const unixDate = ~~(Number(publishedAt) / 1000);
	
	const notificationList = await db.query.notifications.findMany({
		where: eq(notifications.newRelease, true),
		with: {
			email: true,
			discord: true,
			telegram: true,
			slack: true,
			gotify: true,
			ntfy: true,
		},
	});

	for (const notification of notificationList) {
		const { email, discord, telegram, slack, gotify, ntfy } = notification;

		if (email) {
			const template = await renderAsync(
				NewReleaseEmail({ 
					version, 
					releaseNotes, 
					downloadUrl: downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}` 
				}),
			).catch();
			await sendEmailNotification(
				email, 
				`New Dokploy Release ${version} Available`, 
				template
			);
		}

		if (discord) {
			const decorate = (decoration: string, text: string) =>
				`${discord.decoration ? decoration : ""} ${text}`.trim();

			try {
				await sendDiscordNotification(discord, {
					title: decorate("🎉", `New Dokploy Release ${version}`),
					color: 0x00ff00,
					fields: [
						{
							name: decorate("`📦`", "Version"),
							value: version,
							inline: true,
						},
						{
							name: decorate("`📅`", "Released"),
							value: `<t:${unixDate}:D>`,
							inline: true,
						},
						{
							name: decorate("`⏰`", "Time"),
							value: `<t:${unixDate}:t>`,
							inline: true,
						},
					],
					timestamp: publishedAt.toISOString(),
					footer: {
						text: "Dokploy Release Notification",
					},
					url: downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}`,
				});
			} catch (error) {
				console.log("Discord notification error:", error);
			}
		}

		if (gotify) {
			const decorate = (decoration: string, text: string) =>
				`${gotify.decoration ? decoration : ""} ${text}\n`;
			try {
				await sendGotifyNotification(
					gotify,
					decorate("🎉", `New Dokploy Release ${version}`),
					`${decorate("📦", `Version: ${version}`)}${decorate("🕒", `Released: ${publishedAt.toLocaleString()}`)}${decorate("🔗", `Download: ${downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}`}`)}`,
				);
			} catch (error) {
				console.log("Gotify notification error:", error);
			}
		}

		if (ntfy) {
			try {
				await sendNtfyNotification(
					ntfy,
					`New Dokploy Release ${version}`,
					"tada",
					"",
					`📦 Version: ${version}\n🕒 Released: ${publishedAt.toLocaleString()}\n🔗 Download: ${downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}`}`,
				);
			} catch (error) {
				console.log("Ntfy notification error:", error);
			}
		}

		if (telegram) {
			try {
				await sendTelegramNotification(
					telegram,
					`<b>🎉 New Dokploy Release ${version}</b>\n\n<b>Version:</b> ${version}\n<b>Released:</b> ${format(publishedAt, "PP")} at ${format(publishedAt, "pp")}\n\n<b>Download:</b> <a href="${downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}`}">${version}</a>\n\n<b>Update Guide:</b> <a href="https://docs.dokploy.com/docs/core/updating">docs.dokploy.com</a>`,
				);
			} catch (error) {
				console.log("Telegram notification error:", error);
			}
		}

		if (slack) {
			const { channel } = slack;
			try {
				await sendSlackNotification(slack, {
					channel: channel,
					attachments: [
						{
							color: "#00FF00",
							pretext: ":tada: *New Dokploy Release Available!*",
							title: `Dokploy ${version}`,
							title_link: downloadUrl || `https://github.com/dokploy/dokploy/releases/tag/${version}`,
							fields: [
								{
									title: "Version",
									value: version,
									short: true,
								},
								{
									title: "Released",
									value: publishedAt.toLocaleString(),
									short: true,
								},
							],
							footer: "Dokploy Release Notification",
							ts: unixDate,
						},
					],
				});
			} catch (error) {
				console.log("Slack notification error:", error);
			}
		}
	}
};
