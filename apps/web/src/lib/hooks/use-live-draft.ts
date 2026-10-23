'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/** Adopt live data until the user edits; replace a draft only on save or identity change. */
export function useLiveDraft<T>(
  identity: string,
  value: T,
): [T, Dispatch<SetStateAction<T>>, (value: T) => void] {
  const [draft, setDraft] = useState(value);
  const previousIdentity = useRef(identity);
  const dirty = useRef(false);
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      dirty.current = false;
    }
    if (!dirty.current) setDraft(value);
  }, [identity, value]);
  const edit = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    dirty.current = true;
    setDraft(next);
  }, []);
  const accept = useCallback((next: T) => {
    dirty.current = false;
    setDraft(next);
  }, []);
  return [draft, edit, accept];
}
