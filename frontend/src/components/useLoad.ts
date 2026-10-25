import { type DependencyList, useEffect, useState } from "react";

/** Load data when the component mounts (and when `deps` change). No caching library for now. */
export function useLoad<T>(load: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let current = true;
    setError(undefined);
    load().then(
      (result) => current && setData(result),
      (failure: Error) => current && setError(failure),
    );
    return () => {
      current = false;
    };
  }, deps); // callers pass the deps, as with useEffect

  return { data, error, setData };
}
