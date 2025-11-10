export const matchIf = async (
  condition: any,
  onTrue?: () => void | Promise<void>|undefined,
  onFalse?: () => void | Promise<void>,
) => {
  if (await condition) {
    if (onTrue) {
      await onTrue();
    }
  } else {
    if (onFalse) {
      await onFalse();
    }
  }
};
export const matchAllTrue = async (
  conditions: Array<any | (() => any | Promise<any>)>,
  onAllTrue?: () => void | Promise<void>,
  onAnyFalse?: () => void | Promise<void>,
) => {
  const results = await Promise.all(
    conditions.map(condition => 
      typeof condition === 'function' ? condition() : condition
    )
  );
  
  const allTrue = results.every(Boolean);
  
  if (allTrue && onAllTrue) {
    await onAllTrue();
  } else if (!allTrue && onAnyFalse) {
    await onAnyFalse();
  }
  
  return allTrue;
};
