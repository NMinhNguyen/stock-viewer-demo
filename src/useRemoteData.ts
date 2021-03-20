import { useCallback, useReducer } from 'react';

type RemoteData<T> =
  | { isIdle: true; isLoading: false; data?: never; error?: never }
  // Let previous data still be available
  | { isIdle: false; isLoading: true; data?: T; error?: never }
  | { isIdle: false; isLoading: false; data: T; error?: never }
  | { isIdle: false; isLoading: false; data?: never; error: Error };

const PENDING = 'PENDING';
const RESOLVED = 'RESOLVED';
const REJECTED = 'REJECTED';

type RemoteDataAction<T> = [typeof PENDING] | [typeof RESOLVED, T] | [typeof REJECTED, Error];

export function useRemoteData<T>() {
  const [state, dispatch] = useReducer(
    (state: RemoteData<T>, action: RemoteDataAction<T>): RemoteData<T> => {
      switch (action[0]) {
        case PENDING:
          return { ...state, isIdle: false, isLoading: true, error: undefined };
        case REJECTED:
          return {
            ...state,
            isIdle: false,
            isLoading: false,
            error: action[1],
            data: undefined,
          };
        case RESOLVED:
          return {
            ...state,
            isIdle: false,
            isLoading: false,
            data: action[1],
            error: undefined,
          };
      }
    },
    { isIdle: true, isLoading: false },
  );

  type CreateRemoteDataEffectOptions = {
    onSuccess?: (data: T) => void;
  };

  const createRemoteDataEffect = useCallback(
    (fetchData: () => Promise<T>, { onSuccess }: CreateRemoteDataEffectOptions = {}) => {
      let isCancelled = false;
      (async () => {
        dispatch([PENDING]);
        let data: T;
        try {
          data = await fetchData();
        } catch (error) {
          if (!isCancelled) {
            dispatch([REJECTED, error]);
          }
          return;
        }

        if (!isCancelled) {
          dispatch([RESOLVED, data]);
          onSuccess?.(data);
        }
      })();

      return () => {
        isCancelled = true;
      };
    },
    // There appears to be a bug in the current version of react-hooks ESLint plugin used in CodeSandbox:
    // https://github.com/facebook/react/issues/19808#issuecomment-690621723
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { ...state, createRemoteDataEffect };
}
