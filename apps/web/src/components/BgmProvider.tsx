import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { BgmContext } from './BgmContext';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type BgmNodeGraph = {
  context: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
};

function createBgmNodeGraph() {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextConstructor();
  const masterGain = context.createGain();
  const filter = context.createBiquadFilter();
  const delay = context.createDelay();
  const delayGain = context.createGain();
  const oscillators: OscillatorNode[] = [];

  masterGain.gain.value = 0;
  filter.type = 'lowpass';
  filter.frequency.value = 780;
  filter.Q.value = 0.4;
  delay.delayTime.value = 0.28;
  delayGain.gain.value = 0.16;

  filter.connect(masterGain);
  filter.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(masterGain);
  masterGain.connect(context.destination);

  [
    { frequency: 130.81, gain: 0.05, type: 'triangle' as OscillatorType },
    { frequency: 196, gain: 0.035, type: 'sine' as OscillatorType },
    { frequency: 261.63, gain: 0.025, type: 'square' as OscillatorType },
  ].forEach((voice) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = voice.type;
    oscillator.frequency.value = voice.frequency;
    gain.gain.value = voice.gain;

    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start();
    oscillators.push(oscillator);
  });

  return { context, masterGain, oscillators };
}

export function BgmProvider({ children }: PropsWithChildren) {
  const [enabled, setEnabled] = useState(false);
  const nodeGraphRef = useRef<BgmNodeGraph | null>(null);

  const setPlaybackEnabled = useCallback((nextEnabled: boolean) => {
    if (!nodeGraphRef.current) {
      nodeGraphRef.current = createBgmNodeGraph();
    }

    const { context, masterGain } = nodeGraphRef.current;
    void context.resume();

    const now = context.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(nextEnabled ? 0.34 : 0, now, 0.08);
    setEnabled(nextEnabled);
  }, []);

  const toggle = useCallback(() => {
    setPlaybackEnabled(!enabled);
  }, [enabled, setPlaybackEnabled]);

  useEffect(() => {
    return () => {
      const nodeGraph = nodeGraphRef.current;

      if (!nodeGraph) {
        return;
      }

      nodeGraph.oscillators.forEach((oscillator) => oscillator.stop());
      void nodeGraph.context.close();
      nodeGraphRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle]);

  return <BgmContext.Provider value={value}>{children}</BgmContext.Provider>;
}
