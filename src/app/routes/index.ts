import { Router } from "express";
import { userRoutes } from "../modules/user/user.route";
import { authRoutes } from "../modules/auth/auth.route";
import { otpRoutes } from "../modules/otp/otp.routes";
import { settingsRoutes } from "../modules/setting/setting.route";
import { notificationRoutes } from "../modules/notifications/notifications.route";
import { availabilityRoutes } from "../modules/availability/availability.route";
import { categoryRoutes } from "../modules/category/category.route";
import { supportRoutes } from "../modules/support/support.route";
import { FeedbackRoutes } from "../modules/feedback/feedback.route";
import { callRoutes } from "../modules/call/call.route";
import { ChatRoutes } from "../modules/chat/chat.route";
import { messageRoutes } from "../modules/message/message.route";
import path from "path";
import { bookingRoutes } from "../modules/booking/booking.route";
import { paymentRoutes } from "../modules/payment/payment.route";
import { reviewRoutes } from "../modules/reveiw/review.route";
import { overviewRoutes, myOverviewRoutes } from "../modules/overview/overview.route";
import { reportRoutes } from "../modules/report/report.route";


const router = Router();

const moduleRoutes = [
  {
    path: '/users',
    route: userRoutes,
  },
  {
    path: '/auth',
    route: authRoutes,
  },
  {
    path: "/otp",
    route: otpRoutes
  },

  {
    path: "/feedback",
    route: FeedbackRoutes
  },
  {
    path: "/settings",
    route: settingsRoutes
  },
  {
     path: "/notifications",
     route: notificationRoutes
  },
  {
     path: "/availability",
     route: availabilityRoutes
  },
  {
     path: "/categories",
     route: categoryRoutes
  },
  {
    path: "/bookings",
    route: bookingRoutes
  },
  {
    path: "/payments",
    route: paymentRoutes
  },
  {
     path: "/support",
     route: supportRoutes
  },
  {
      path: "/chat",
      route: ChatRoutes
  },
  {
      path: "/message",
      route: messageRoutes
  },
  {
     path: "/calls",
     route: callRoutes
  },
  {
     path: "/reviews",
     route: reviewRoutes
  },
  {
     path: "/admin/overview",
     route: overviewRoutes
  },
  {
     path: "/overview",
     route: myOverviewRoutes
  },
  {
    path: "/reports",
    route: reportRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;