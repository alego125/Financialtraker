import { useEffect, useRef } from 'react';
import { createRequestScope } from '../utils/requestScope';
export default function useRequestScope() {
  const scope = useRef(null);
  if (!scope.current) scope.current = createRequestScope();
  useEffect(() => () => scope.current.cancel(), []);
  return scope.current;
}
