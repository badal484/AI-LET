# Runbook: Real-Time Voice Streaming Gateway Outage

## 1. Symptoms & Alert Triggers
- Prometheus alert `VoiceSessionDisconnectRate` ($> 3\%$).
- Voice WebSocket connection failure alert (`VOICE_CONNECTION_FAILED` / `VOICE_TTS_FAILED`).
- Latency P95 from STT audio upload to first audio chunk $> 2,500\text{ms}$.

## 2. Diagnosis
1. Inspect WebSocket connection count on voice gateway cluster:
   ```bash
   kubectl logs -n production -l app=ai-companion-voice --tail=100
   ```
2. Check upstream TTS provider health (ElevenLabs Turbo / OpenAI TTS-1).
3. Validate client audio encoding compatibility (PCM-16 24kHz).

## 3. Mitigation Protocols
1. **Switch Upstream TTS Provider**:
   In Admin Voice Configuration (`/api/v1/admin/voice`), toggle primary TTS provider from `ELEVENLABS_TURBO` to `OPENAI_TTS_1` or vice-versa.
2. **Activate Voice Kill Switch**:
   If voice gateway cluster is unstable or provider cost spikes erratically:
   Toggle `KillSwitchService` key `voice_calls` to `false`. Mobile client will display clean text fallback with empathetic messaging.

## 4. Verification
- Initiate synthetic voice session from Admin Voice Playground.
- Verify two-way audio latency $< 350\text{ms}$ and zero packet drop.

## 5. Escalation
- **Primary**: Voice Systems Engineer On-Call
- **Secondary**: Platform Engineering Lead
