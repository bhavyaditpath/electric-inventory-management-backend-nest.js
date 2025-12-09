import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('EMAIL_HOST'),
      port: 465,
      secure: true,
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASS'),
      },
    });

    this.transporter.verify((err, success) => {
      if (err) {
        console.error("SMTP Connection Error:", err);
      } else {
        console.log("SMTP Server is ready to take messages");
      }
    });


  }

  async sendResetPasswordEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${token}`;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM') || this.configService.get<string>('EMAIL_USER'),
      to,
      subject: 'Reset Your Password',
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendReportEmail(
    to: string,
    subject: string,
    html: string,
    attachment?: {
      filename: string;
      content: Buffer;
      contentType: string;
    }
  ): Promise<void> {
    const mailOptions: any = {
      from: this.configService.get<string>('EMAIL_FROM') || this.configService.get<string>('EMAIL_USER'),
      to,
      subject,
      html,
    };

    if (attachment) {
      mailOptions.attachments = [attachment];
    }

    await this.transporter.sendMail(mailOptions);
  }
}