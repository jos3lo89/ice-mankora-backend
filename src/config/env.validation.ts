import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  APP_ENV: Joi.string().valid('development', 'production').required(),
  PORT: Joi.number().required(),
  JWT_SECRET: Joi.string().required(),
});
