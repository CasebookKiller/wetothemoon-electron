/**
 * Water Discipline — восстановление, арбитр нагрузки.
 */

export type TrafficLight = 'green' | 'yellow' | 'red';

export interface RecoveryLog {
  /** YYYY-MM-DD */
  date: string;
  sleepHours?: number;
  /** 1..5 */
  sleepQuality?: number;
  hrv?: number;
  restingHr?: number;
  trafficLight?: TrafficLight;
  notes?: string;
}