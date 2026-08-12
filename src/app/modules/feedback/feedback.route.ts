import { Router } from "express";
import { FeedbackController } from "./feedback.controller";
import auth from "../../middleware/auth";
import { USER_ROLE } from "../user/user.constants";

const router = Router();

router
    .post(
    "/add",
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    FeedbackController.createFeedback
    )

    .get(
    "/",
    // auth(USER_ROLE.ADMIN), // only admin can see all feedbacks
    FeedbackController.getAllFeedbacks
    )

    .get(
       "/admin",
       auth(USER_ROLE.ADMIN),
       FeedbackController.getAllFeedbacksByAdmin
    )

    .get(
    "/:id",
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    FeedbackController.getFeedbackById
    )

    .patch(
    "/update/:id",
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    FeedbackController.updateFeedback
    )


    .patch(
        "/verify/:id",
        auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
        FeedbackController.verifyFeedbackById
    )

    

    .delete(
        "/:id",
        auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
        FeedbackController.deleteFeedback
    );

export const FeedbackRoutes = router;
