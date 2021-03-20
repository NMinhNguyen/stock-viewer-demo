import type { PropsWithChildren } from 'react';
import Alert from '@material-ui/core/Alert';
import AlertTitle from '@material-ui/core/AlertTitle';
import Button from '@material-ui/core/Button';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="secondary" onClick={resetErrorBoundary}>
          Try again
        </Button>
      }
    >
      <AlertTitle>Something went wrong</AlertTitle>
      <pre>{error.toString()}</pre>
    </Alert>
  );
}
export function ErrorBoundary({ children }: PropsWithChildren<{}>) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        console.error(error);
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
