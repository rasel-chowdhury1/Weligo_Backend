import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import { Availability } from './availability.model';
import {
  TBookingRule,
  TDayAvailability,
  TWeekDay,
  WEEK_DAYS,
} from './availability.interface';

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const isOverlapping = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);

const buildDefaultWeeklySchedule = (): TDayAvailability[] =>
  WEEK_DAYS.map((day) => ({
    day,
    isAvailable: false,
    slots: [],
  }));

// ensures every weekday is present, self-healing older documents
const ensureAllDaysExist = (weeklySchedule: TDayAvailability[]) => {
  WEEK_DAYS.forEach((day) => {
    const exists = weeklySchedule.some((entry) => entry.day === day);
    if (!exists) {
      weeklySchedule.push({ day, isAvailable: false, slots: [] });
    }
  });
};

const getOrCreateAvailability = async (userId: string) => {
  let availability = await Availability.findOne({ user: userId });

  if (!availability) {
    availability = await Availability.create({
      user: userId,
      weeklySchedule: buildDefaultWeeklySchedule(),
      bookingRules: {},
    });
    return availability;
  }

  ensureAllDaysExist(availability.weeklySchedule as TDayAvailability[]);
  if (availability.isModified('weeklySchedule')) {
    await availability.save();
  }

  return availability;
};

const getDayOrThrow = (
  weeklySchedule: TDayAvailability[],
  day: TWeekDay,
) => {
  const dayAvailability = weeklySchedule.find((entry) => entry.day === day);
  if (!dayAvailability) {
    throw new AppError(httpStatus.NOT_FOUND, `Availability for ${day} not found`);
  }
  return dayAvailability;
};

const getMyAvailability = async (userId: string) => {
  return getOrCreateAvailability(userId);
};

const toggleDayAvailability = async (
  userId: string,
  day: TWeekDay,
  isAvailable: boolean,
) => {
  const availability = await getOrCreateAvailability(userId);
  const dayAvailability = getDayOrThrow(
    availability.weeklySchedule as TDayAvailability[],
    day,
  );

  dayAvailability.isAvailable = isAvailable;
  availability.markModified('weeklySchedule');
  await availability.save();

  return availability;
};

const addTimeSlot = async (
  userId: string,
  day: TWeekDay,
  startTime: string,
  endTime: string,
) => {
  if (startTime >= endTime) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'startTime must be earlier than endTime',
    );
  }

  const availability = await getOrCreateAvailability(userId);
  const dayAvailability = getDayOrThrow(
    availability.weeklySchedule as TDayAvailability[],
    day,
  );

  const hasConflict = dayAvailability.slots.some((slot) =>
    isOverlapping(startTime, endTime, slot.startTime, slot.endTime),
  );
  if (hasConflict) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This time slot overlaps with an existing slot for the selected day',
    );
  }

  dayAvailability.slots.push({ startTime, endTime });
  availability.markModified('weeklySchedule');
  await availability.save();

  return availability;
};

const updateTimeSlot = async (
  userId: string,
  day: TWeekDay,
  slotId: string,
  startTime: string | undefined,
  endTime: string | undefined,
) => {
  const availability = await getOrCreateAvailability(userId);
  const dayAvailability = getDayOrThrow(
    availability.weeklySchedule as TDayAvailability[],
    day,
  );

  const slot = dayAvailability.slots.find(
    (item) => item._id?.toString() === slotId,
  );
  if (!slot) {
    throw new AppError(httpStatus.NOT_FOUND, 'Time slot not found');
  }

  const nextStartTime = startTime ?? slot.startTime;
  const nextEndTime = endTime ?? slot.endTime;

  if (nextStartTime >= nextEndTime) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'startTime must be earlier than endTime',
    );
  }

  const hasConflict = dayAvailability.slots.some(
    (item) =>
      item._id?.toString() !== slotId &&
      isOverlapping(nextStartTime, nextEndTime, item.startTime, item.endTime),
  );
  
  if (hasConflict) {
    throw new AppError(
      httpStatus.CONFLICT,
      'This time slot overlaps with an existing slot for the selected day',
    );
  }

  slot.startTime = nextStartTime;
  slot.endTime = nextEndTime;
  availability.markModified('weeklySchedule');
  await availability.save();

  return availability;
};

const deleteTimeSlot = async (userId: string, day: TWeekDay, slotId: string) => {
  const availability = await getOrCreateAvailability(userId);
  const dayAvailability = getDayOrThrow(
    availability.weeklySchedule as TDayAvailability[],
    day,
  );

  const slotIndex = dayAvailability.slots.findIndex(
    (item) => item._id?.toString() === slotId,
  );
  if (slotIndex === -1) {
    throw new AppError(httpStatus.NOT_FOUND, 'Time slot not found');
  }

  dayAvailability.slots.splice(slotIndex, 1);
  availability.markModified('weeklySchedule');
  await availability.save();

  return availability;
};

const updateBookingRules = async (
  userId: string,
  payload: Partial<TBookingRule>,
) => {
  const availability = await getOrCreateAvailability(userId);

  availability.bookingRules = {
    ...availability.bookingRules,
    ...payload,
  };
  availability.markModified('bookingRules');
  await availability.save();

  return availability;
};

export const availabilityService = {
  getMyAvailability,
  toggleDayAvailability,
  addTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  updateBookingRules,
};
