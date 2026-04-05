export interface SensorData {
  heartRate: number;
  temperature: number;
  sleepHours: number;
  steps: number;
  emotion: string;
  location: string;
  weather: string;
}

export interface RobotResponse {
  text: string;
  confidence: number;
  action: "REST" | "HYDRATE" | "ALERT" | "MONITOR";
  gatewaysUsed?: {
    health: boolean;
    companion: boolean;
    intent?: string;
  };
}

export interface Robot {
  id: string;
  name: string;
  type: string;
  userId: string;
  userName: string;
  userAge: number;
  status: "active" | "alert" | "offline";
  lastPing: number;
  uptime: number;
  totalQueries: number;
  sensors: SensorData;
  lastResponse: RobotResponse | null;
  alertMessage?: string;
}

export const initialRobots: Robot[] = [
  {
    id: "KIRO-ELDER-001",
    name: "ElderCare Companion Unit",
    type: "ElderCare",
    userId: "rahul-sharma-v2",
    userName: "Rahul Sharma",
    userAge: 72,
    status: "active",
    lastPing: Date.now(),
    uptime: 99.2,
    totalQueries: 847,
    sensors: {
      heartRate: 98,
      temperature: 99.1,
      sleepHours: 4.2,
      steps: 230,
      emotion: "Distressed",
      location: "Bedroom",
      weather: "Rainy",
    },
    lastResponse: {
      text: "Based on low sleep and rain exposure, Rahul's fatigue is expected. Rest recommended.",
      confidence: 0.91,
      action: "REST",
    },
  },
  {
    id: "KIRO-MED-002",
    name: "Hospital Companion Unit",
    type: "Hospital",
    userId: "priya-nair-v2",
    userName: "Priya Nair",
    userAge: 65,
    status: "alert",
    lastPing: Date.now(),
    uptime: 98.7,
    totalQueries: 392,
    sensors: {
      heartRate: 124,
      temperature: 101.3,
      sleepHours: 3.1,
      steps: 45,
      emotion: "Anxious",
      location: "Hospital Room",
      weather: "Cloudy",
    },
    lastResponse: {
      text: "Heart rate critical at 124bpm. Nurse has been notified.",
      confidence: 0.96,
      action: "ALERT",
    },
    alertMessage: "Heart rate critical at 124bpm — Caregiver notified",
  },
  {
    id: "KIRO-HOME-003",
    name: "Home Companion Unit",
    type: "Home",
    userId: "arjun-mehta-v2",
    userName: "Arjun Mehta",
    userAge: 45,
    status: "active",
    lastPing: Date.now(),
    uptime: 97.1,
    totalQueries: 156,
    sensors: {
      heartRate: 74,
      temperature: 98.4,
      sleepHours: 7.5,
      steps: 3240,
      emotion: "Calm",
      location: "Living Room",
      weather: "Sunny",
    },
    lastResponse: {
      text: "Arjun is doing well today. Sleep and vitals are within normal range.",
      confidence: 0.88,
      action: "MONITOR",
    },
  },
  {
    id: "KIRO-TEST-004",
    name: "Test Unit",
    type: "Test",
    userId: "unassigned",
    userName: "Unassigned",
    userAge: 0,
    status: "offline",
    lastPing: Date.now() - 4 * 3600 * 1000,
    uptime: 0,
    totalQueries: 0,
    sensors: {
      heartRate: 0,
      temperature: 0,
      sleepHours: 0,
      steps: 0,
      emotion: "N/A",
      location: "N/A",
      weather: "N/A",
    },
    lastResponse: null,
  },
];

export function randomizeSensors(robot: Robot): Robot {
  if (robot.status === "offline") return robot;
  const sensors = { ...robot.sensors };
  sensors.heartRate = Math.max(60, Math.min(140, sensors.heartRate + (Math.random() * 6 - 3)));
  sensors.heartRate = Math.round(sensors.heartRate);
  sensors.temperature = Math.round((sensors.temperature + (Math.random() * 0.4 - 0.2)) * 10) / 10;
  sensors.steps = sensors.steps + Math.floor(Math.random() * 15);
  return { ...robot, sensors, lastPing: Date.now() };
}

export const seedMemoriesData: Record<string, string[]> = {
  rahul: [
    "Rahul slept 4 hours, heart rate 102bpm, emotion distressed, weather rainy, said feeling tired",
    "Rahul skipped breakfast, heart rate 88bpm, steps 150, location bedroom, mood low",
    "Rahul sleep 3.5 hours, temperature 99.2F, emotion anxious, said cannot sleep well",
    "Rahul exposed to rain 40 mins, steps 890, heart rate 95bpm, fatigue reported",
    "Rahul sleep 8 hours, heart rate 72bpm, steps 4200, mood happy, said feeling great",
    "Pattern: Rahul low sleep under 5 hours combined with rain leads to fatigue next morning",
    "Pattern: Rahul skipped meals combined with high heart rate indicates stress response",
  ],
  priya: [
    "Priya post-surgery day 3, heart rate 118bpm, temperature 100.8F, sleep 3 hours, pain reported",
    "Priya skipped dinner, heart rate 110bpm, steps 45, location hospital room, anxious",
    "Priya sleep 2.5 hours, temperature 101F, emotion anxious, said feeling dizzy",
    "Pattern: Priya heart rate above 115bpm consistently indicates pain escalation",
    "Pattern: Priya poor sleep combined with low food intake leads to dizziness",
  ],
  arjun: [
    "Arjun sleep 7.5 hours, heart rate 74bpm, steps 3200, mood calm, said feeling good",
    "Arjun had healthy meals, heart rate 72bpm, steps 4100, location living room, happy",
    "Arjun exercise 30 mins, heart rate 85bpm post-exercise, mood energetic",
    "Pattern: Arjun consistent sleep above 7 hours maintains stable heart rate",
    "Pattern: Arjun regular exercise correlates with positive mood and lower resting HR",
  ],
};
