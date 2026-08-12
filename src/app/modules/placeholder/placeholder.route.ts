import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * TEMPORARY placeholder for the frontend's payment return page.
 * Delete this once a real frontend exists. Datatrans redirects the
 * customer's browser here after checkout - `status` is whichever of
 * successUrl/cancelUrl/errorUrl we sent, and `datatransTrxId` is appended
 * by Datatrans itself (useful for manually checking a transaction while testing).
 */
router.get('/return', (req: Request, res: Response) => {
  const { status, datatransTrxId } = req.query;

  const statusConfig: Record<string, { label: string; color: string }> = {
    success: { label: 'Payment hold placed successfully', color: '#16a34a' },
    cancel: { label: 'Payment was cancelled', color: '#d97706' },
    error: { label: 'Payment failed', color: '#dc2626' },
  };

  const config = statusConfig[status as string] ?? { label: 'Unknown status', color: '#6b7280' };

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Payment ${status ?? 'return'}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f9fafb;
          }
          .card {
            background: white;
            padding: 32px 40px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 420px;
          }
          h1 { color: ${config.color}; font-size: 20px; margin-bottom: 8px; }
          p { color: #6b7280; font-size: 14px; }
          .badge {
            display: inline-block;
            background: #f3f4f6;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            margin-top: 12px;
            color: #374151;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${config.label}</h1>
          <p>Placeholder page - replace with the real frontend's return page once it exists.</p>
          ${datatransTrxId ? `<div class="badge">datatransTrxId: ${datatransTrxId}</div>` : ''}
        </div>
      </body>
    </html>
  `);
});

export const paymentReturnPlaceholderRoutes = router;