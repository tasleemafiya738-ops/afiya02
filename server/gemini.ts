import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiAnalysisReport,
  MonitoringStation,
  SensorReading,
  StatisticalSignal,
  SystemMode,
  ThresholdSettings,
  WaterAlert,
} from '../src/types/water.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function runAiAnomalyAnalysis(params: {
  mode: SystemMode;
  targetStationId: string | 'all';
  stations: MonitoringStation[];
  readings: SensorReading[];
  statisticalSignals: StatisticalSignal[];
  activeAlerts: WaterAlert[];
  settings: ThresholdSettings;
}): Promise<AiAnalysisReport> {
  const ai = getGeminiClient();

  const targetStations =
    params.targetStationId === 'all'
      ? params.stations
      : params.stations.filter((s) => s.id === params.targetStationId);

  const stationContext = targetStations.map((st) => {
    const recent = params.readings
      .filter((r) => r.stationId === st.id)
      .slice(-18)
      .map((r) => ({
        t: r.timestamp,
        ph: r.ph,
        ntu: r.turbidity,
        tempC: r.temperature,
        dPh: r.deltaPh,
        dNtu: r.deltaTurbidity,
        status: r.qualityStatus,
      }));
    const signal = params.statisticalSignals.find((sig) => sig.stationId === st.id) || null;
    const alerts = params.activeAlerts
      .filter((a) => a.stationId === st.id && !a.resolved)
      .slice(0, 5)
      .map((a) => ({
        type: a.alertType,
        category: a.category,
        severity: a.severity,
        value: a.detectedValue,
        time: a.timestamp,
      }));

    return {
      stationId: st.id,
      name: st.name,
      pipelineSegment: st.pipelineSegment,
      connectionStatus: st.connectionStatus,
      lastCalibration: st.lastCalibration,
      statisticalBaseline: signal,
      activeRuleAlerts: alerts,
      recentTimeSeries: recent,
    };
  });

  const systemInstruction = `You are AquaGuard AI, a drinking-water distribution telemetry analyst specializing in low-cost pH and turbidity sensor monitoring.
STRICT SCIENTIFIC & ENGINEERING GUARDRAILS:
1. NEVER claim water is "safe to drink" or "potable" based solely on pH and turbidity. Use accurate phrasing like "within operational pH/turbidity reference limits; laboratory verification is required for potability."
2. NEVER claim to identify specific chemical or biological contaminants (such as E. coli, lead, chlorine decay, arsenic, or pathogens) without laboratory testing. Refer only to physical-chemical parameter behavior (e.g. "particulate resuspension", "possible buffering/alkalinity shift", "sensor fouling or air bubble artifact", "pipeline disturbance").
3. NEVER claim 0% error, certainty, or perfect detection. Always explain sensor limitations (probe drift, biofouling, calibration lag) and the necessity of manual confirmatory sampling.
4. Clearly distinguish between:
   - Rule-based threshold alerts (hard limits: pH ${params.settings.phMin}-${params.settings.phMax}, turbidity warning > ${params.settings.turbidityWarning} NTU, critical >= ${params.settings.turbidityCritical} NTU)
   - AI/statistical pattern predictions (unusual rate-of-change, z-score drift, or multi-point trend anomalies even while values remain inside hard threshold boundaries).
5. Keep all text concise, practical, and actionable for municipal water utility operators.`;

  const prompt = `Analyze the following ${params.mode === 'demo' ? 'DEMO DATA (simulated)' : 'LIVE SENSOR'} telemetry snapshot and historical baseline from our drinking-water distribution stations.
Configured thresholds: pH ${params.settings.phMin}–${params.settings.phMax}, Turbidity target <= ${params.settings.turbidityTarget} NTU, Warning > ${params.settings.turbidityWarning} NTU, Critical >= ${params.settings.turbidityCritical} NTU, Sudden delta pH >= ${params.settings.phSuddenDelta}, Sudden delta Turbidity >= ${params.settings.turbiditySuddenDelta}.

Station Telemetry & Statistical Baselines:
${JSON.stringify(stationContext, null, 2)}

Provide a structured JSON anomaly report comparing current readings against historical baselines, explaining why any rule alerts or sub-threshold AI pattern anomalies occurred, and recommending practical next steps.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          networkAssessment: {
            type: Type.STRING,
            description: '2-3 sentence executive summary of current pipeline telemetry patterns across the analyzed stations.',
          },
          ruleVsAiDistinction: {
            type: Type.STRING,
            description: 'Clear explanation distinguishing hard rule-based threshold breaches from AI/statistical trend predictions in this dataset.',
          },
          verificationReminder: {
            type: Type.STRING,
            description: 'Concise engineering note on sensor calibration, measurement uncertainty, and why pH/turbidity alone cannot certify potability.',
          },
          findings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stationId: { type: Type.STRING },
                anomalyDetected: { type: Type.BOOLEAN },
                confidenceNote: {
                  type: Type.STRING,
                  description: 'Honest qualitative confidence note acknowledging sensor limits (e.g. Moderate — corroborated by z-score drift; requires probe check).',
                },
                distinctionType: {
                  type: Type.STRING,
                  enum: [
                    'AI Pattern Prediction',
                    'Corroborated Threshold & Pattern',
                    'Within Expected Baseline',
                  ],
                },
                severity: {
                  type: Type.STRING,
                  enum: ['low', 'moderate', 'elevated'],
                },
                summary: { type: Type.STRING },
                comparisonWithBaseline: { type: Type.STRING },
                possibleDisturbanceFactors: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                recommendedActions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                limitationsNote: { type: Type.STRING },
              },
              required: [
                'stationId',
                'anomalyDetected',
                'confidenceNote',
                'distinctionType',
                'severity',
                'summary',
                'comparisonWithBaseline',
                'possibleDisturbanceFactors',
                'recommendedActions',
                'limitationsNote',
              ],
            },
          },
        },
        required: [
          'networkAssessment',
          'ruleVsAiDistinction',
          'verificationReminder',
          'findings',
        ],
      },
    },
  });

  const rawText = response.text?.trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty anomaly analysis response.');
  }

  const parsed = JSON.parse(rawText) as {
    networkAssessment: string;
    ruleVsAiDistinction: string;
    verificationReminder: string;
    findings: AiAnalysisReport['findings'];
  };

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    mode: params.mode,
    targetStationId: params.targetStationId,
    modelUsed: 'gemini-4-hydrogen',
    networkAssessment: parsed.networkAssessment,
    ruleVsAiDistinction: parsed.ruleVsAiDistinction,
    findings: parsed.findings,
    verificationReminder: parsed.verificationReminder,
  };
}
