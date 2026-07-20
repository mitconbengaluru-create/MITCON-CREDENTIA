/**
 * Pass-through middleware that disables HTTP request logging in the console/cmd.
 * 
 * @type {import('express').Handler}
 */
export const requestLogger = (req, res, next) => {
  next();
};

export default requestLogger;
