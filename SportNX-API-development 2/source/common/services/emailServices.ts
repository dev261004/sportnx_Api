import path from "path";
import fs from "fs";
import handlebars from "handlebars";
import nodemailer from "nodemailer";
import config from "../config/config";
import logger from "../config/logger";

// Common email sending function
export const sendEmail = async (params: {
  to: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  html?: string;
  subject?: string;
}) => {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: config.email.gmailUser,
        pass: config.email.gmailPassword,
      },
    });

    let htmlContent: string;

    if (params.templateId) {
      // Read HTML template from file
      const templatePath = path.join(
        __dirname,
        `../templates/${params.templateId}.html`
      );
      const source = fs.readFileSync(templatePath, "utf8");

      // Compile the template with Handlebars
      const template = handlebars.compile(source);

      // Add common data to dynamic template data
      const dynamicData = {
        ...params.dynamicTemplateData,
        year: new Date().getFullYear(),
        privacyPolicyLink: config.webUrl + "/privacy-policy",
        termsNConditionsLink: config.webUrl + "/terms-conditions",
        contactUsLink: config.webUrl + "/contact-us",
      };

      // Prepare dynamic data
      htmlContent = template(dynamicData);
    } else {
      htmlContent = params.html || "";
    }

    // Send email
    const mailOptions = {
      from: {
        name: "SportNX",
        address: config.email.emailOwner,
      },
      to: params.to,
      subject: params.subject || "SportNX Notification",
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.debug(`Email sent successfully to ${params.to}`);
    return info;
  } catch (error) {
    logger.error("Email error:", error);
    throw error;
  }
};
