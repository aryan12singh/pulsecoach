export type Source = "apple_health" | "hevy" | "strava" | "manual";
export type WorkoutType = "strength" | "running" | "cycling" | "walking" | "other";
export type WeightUnit = "kg" | "lb";
export type Comparison = "gte" | "lte";
export type Window = "daily" | "weekly" | "monthly" | "all_time";
export type MetricScope = "workout" | "strength" | "health_metric";
export type GoalStatusLabel = "on_track" | "behind" | "ahead" | "completed";

export interface StrengthSet {
  id: number;
  workout_id: number;
  exercise_name: string;
  exercise_order: number;
  set_number: number;
  reps: number | null;
  weight: number | null;
  weight_unit: WeightUnit;
  rpe: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  is_warmup: boolean;
}

export interface Workout {
  id: number;
  source: Source;
  external_id: string | null;
  workout_type: WorkoutType;
  raw_type: string | null;
  start_at: string;
  end_at: string | null;
  duration_mins: number;
  active_calories: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  distance_km: number | null;
  has_strength_detail: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutDetail extends Workout {
  strength_sets: StrengthSet[];
}

export interface WeeklySummary {
  week_start: string;
  sessions_count: number;
  total_calories: number;
  avg_duration_mins: number;
  avg_heart_rate: number | null;
  most_common_type: string | null;
  total_strength_volume: number;
}

export interface MonthlySummary {
  month_start: string;
  sessions_count: number;
  total_calories: number;
  avg_duration_mins: number;
  avg_heart_rate: number | null;
  most_common_type: string | null;
  total_strength_volume: number;
}

export interface StrengthProgressPoint {
  date: string;
  top_weight: number;
  total_volume: number;
  sets_count: number;
}

export interface HealthMetric {
  id: number;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  date: string;
  source: Source;
}

export interface MetricSummaryItem {
  metric_type: string;
  latest_value: number | null;
  unit: string;
  trend: number | null;
}

export interface Goal {
  id: number;
  goal_type: string;
  metric_scope: MetricScope;
  target_value: number;
  target_unit: string;
  comparison: Comparison;
  window: Window;
  deadline: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalStatus extends Goal {
  current_value: number;
  percentage_complete: number;
  status: GoalStatusLabel;
}

export interface ChatMessage {
  id: number;
  user_message: string;
  ai_response: string;
  model: string;
  created_at: string;
}

export interface AppConfig {
  coaching_enabled: boolean;
  hevy_enabled: boolean;
  strava_enabled: boolean;
  analytics_enabled: boolean;
}

export interface ExercisePR {
  exercise_name: string;
  best_weight: number;
  best_weight_unit: string;
  best_weight_date: string;
  best_est_1rm: number;
  best_est_1rm_date: string;
  is_recent_pr: boolean;
}

export interface MuscleVolume {
  muscle_group: string;
  total_volume: number;
  sets_count: number;
}

export interface OvertrainingFlag {
  metric: string;
  level: "ok" | "caution" | "high";
  value: number;
  message: string;
}

export interface AnalyticsSummary {
  prs: ExercisePR[];
  muscle_volume: MuscleVolume[];
  overtraining: OvertrainingFlag[];
  window_days: number;
}
