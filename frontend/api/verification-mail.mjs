import nodemailer from 'nodemailer';
import { createVerificationHandler } from '../server/verification-mail.mjs';

export default {
  fetch: createVerificationHandler({
    readEnv: () => process.env,
    makeTransport: options => nodemailer.createTransport(options),
  }),
};
