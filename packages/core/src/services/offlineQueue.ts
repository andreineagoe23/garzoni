/**
 * Offline queue service for mission submissions.
 * Queues mission completions when offline and syncs when back online.
 */

const OFFLINE_QUEUE_KEY = "garzoni:mission-offline-queue";
const MAX_QUEUE_SIZE = 50;

export type OfflineMission = {
  mission_id: string | number;
  mission_name?: string;
  idempotency_key: string;
  first_try?: boolean;
  hints_used?: number;
  attempts?: number;
  mastery_bonus?: number;
  completion_time_seconds?: number;
  queued_at?: string;
};

/**
 * Get the offline queue from localStorage
 */
export function getOfflineQueue(): OfflineMission[] {
  try {
    const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Add a mission completion to the offline queue
 */
export function queueMissionCompletion(missionData: OfflineMission): boolean {
  try {
    const queue = getOfflineQueue();

    // Prevent duplicates
    const existing = queue.find(
      (item) => item.idempotency_key === missionData.idempotency_key,
    );
    if (existing) {
      return false;
    }

    // Limit queue size
    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift(); // Remove oldest
    }

    queue.push({
      ...missionData,
      queued_at: new Date().toISOString(),
    });

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Remove a mission completion from the queue
 */
export function removeFromQueue(idempotencyKey: string): boolean {
  try {
    const queue = getOfflineQueue();
    const filtered = queue.filter(
      (item) => item.idempotency_key !== idempotencyKey,
    );
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Clear the entire queue
 */
export function clearQueue(): boolean {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Generate an idempotency key for mission completion
 */
export function generateIdempotencyKey(
  missionId: string | number,
  userId: string | number,
) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${userId}_${missionId}_${timestamp}_${random}`;
}
