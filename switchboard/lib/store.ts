"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getExchange } from "./exchange";
import { Connection, Line, Summary } from "./types";

const EMPTY_SUMMARY: Summary = {
  open: 0, thinking: 0, replying: 0, waiting: 0, resolvedToday: 0, avgConfidence: 0,
};
const EMPTY_LIST: Line[] = [];

export function useBootExchange() {
  useEffect(() => {
    const ex = getExchange();
    ex.boot();
    return () => {
      // keep the singleton alive across HMR; only tear down on real unload
    };
  }, []);
}

export function useConnection(): Connection {
  const ex = getExchange();
  return useSyncExternalStore(ex.subscribeMeta, ex.getConnection, () => "booting" as Connection);
}

export function useSummary(): Summary {
  const ex = getExchange();
  return useSyncExternalStore(ex.subscribeMeta, ex.getSummary, () => EMPTY_SUMMARY);
}

export function useList(): Line[] {
  const ex = getExchange();
  return useSyncExternalStore(ex.subscribeList, ex.getList, () => EMPTY_LIST);
}

export function useLine(id: string | null): Line | undefined {
  const ex = getExchange();
  const subscribe = useCallback(
    (cb: () => void) => (id ? ex.subscribeLine(id)(cb) : () => {}),
    [ex, id],
  );
  const getSnapshot = useCallback(() => (id ? ex.getLineSnap(id) : undefined), [ex, id]);
  return useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

export function useExchange() {
  return getExchange();
}
