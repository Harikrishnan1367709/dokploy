import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import * as React from "react";

interface NewReleaseEmailProps {
	version: string;
	releaseNotes?: string;
	downloadUrl?: string;
}

export const NewReleaseEmail = ({
	version,
	releaseNotes,
	downloadUrl = "https://github.com/dokploy/dokploy/releases/latest",
}: NewReleaseEmailProps) => (
	<Html>
		<Head />
		<Preview>New Dokploy Release {version} is now available!</Preview>
		<Body style={main}>
			<Container style={container}>
				<Img
					src="https://dokploy.com/logo.svg"
					width="40"
					height="40"
					alt="Dokploy"
					style={logo}
				/>
				<Heading style={h1}>New Dokploy Release Available!</Heading>
				<Text style={text}>
					We're excited to announce that Dokploy {version} is now available for download.
				</Text>
				<Section style={buttonContainer}>
					<Button style={button} href={downloadUrl}>
						Download {version}
					</Button>
				</Section>
				{releaseNotes && (
					<Section style={releaseNotesSection}>
						<Heading style={h2}>What's New</Heading>
						<Text style={releaseNotesText}>{releaseNotes}</Text>
					</Section>
				)}
				<Text style={text}>
					To update your Dokploy instance, please follow the{" "}
					<Link href="https://docs.dokploy.com/docs/core/updating" style={link}>
						update guide
					</Link>{" "}
					in our documentation.
				</Text>
				<Text style={text}>
					If you have any questions or need help with the update process, please don't
					hesitate to reach out to our support team.
				</Text>
				<Text style={footer}>
					Best regards,
					<br />
					The Dokploy Team
				</Text>
			</Container>
		</Body>
	</Html>
);

export default NewReleaseEmail;

const main = {
	backgroundColor: "#f6f9fc",
	fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
	backgroundColor: "#ffffff",
	margin: "0 auto",
	padding: "20px 0 48px",
	marginBottom: "64px",
};

const logo = {
	margin: "0 auto",
};

const h1 = {
	color: "#333",
	fontSize: "24px",
	fontWeight: "bold",
	margin: "40px 0",
	padding: "0",
};

const h2 = {
	color: "#333",
	fontSize: "20px",
	fontWeight: "bold",
	margin: "30px 0 15px",
	padding: "0",
};

const text = {
	color: "#333",
	fontSize: "16px",
	lineHeight: "26px",
};

const releaseNotesText = {
	color: "#666",
	fontSize: "14px",
	lineHeight: "22px",
	backgroundColor: "#f8f9fa",
	padding: "15px",
	borderRadius: "5px",
	border: "1px solid #e9ecef",
};

const releaseNotesSection = {
	margin: "30px 0",
};

const buttonContainer = {
	textAlign: "center" as const,
	margin: "32px 0",
};

const button = {
	backgroundColor: "#007ee6",
	borderRadius: "4px",
	color: "#fff",
	fontSize: "16px",
	textDecoration: "none",
	textAlign: "center" as const,
	display: "block",
	padding: "12px 20px",
};

const link = {
	color: "#007ee6",
	textDecoration: "underline",
};

const footer = {
	color: "#898989",
	fontSize: "12px",
	lineHeight: "22px",
	marginTop: "30px",
};
