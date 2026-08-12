/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import globalErrorHandler from './app/middleware/globalErrorhandler';
// import notFound from './app/middleware/notfound';
import router from './app/routes';
import notFound from './app/middleware/notfound';
import serverHomePage from './app/helpers/serverHomePage';
import { logErrorHandler, logHttpRequests } from './app/utils/logger';
import { paymentReturnPlaceholderRoutes } from './app/modules/placeholder/placeholder.route';
const app: Application = express();
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

//parsers
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

app.use(cookieParser());
app.use(
  cors({
    origin: true,
    // origin: '',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }),
);

// Remove duplicate static middleware
// app.use(app.static('public'));

app.use(logHttpRequests);

app.use('/payments', paymentReturnPlaceholderRoutes);
// application routes
app.use('/api/v1', router);

app.get('/', async (req: Request, res: Response) => {
  const htmlContent = await serverHomePage(); // Wait for HTML generation
  res.send(htmlContent); // Send the generated HTML
});



/* ---------- Error handling ---------- */
// Error handler middleware
app.use(logErrorHandler);

app.use(globalErrorHandler);

//Not Found
app.use(notFound);

export default app;
