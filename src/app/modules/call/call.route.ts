import { Router } from 'express';
import auth from '../../middleware/auth';
import { USER_ROLE } from '../user/user.constants';
import { callController } from './call.controller';

export const callRoutes = Router();

callRoutes
  .get(
    '/my-calls',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    callController.getMyCallHistory,
  )

  .get(
    '/:id',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    callController.getCallById,
  );
