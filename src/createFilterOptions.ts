import type { FilterOptionsState } from '@material-ui/core/useAutocomplete';

// https://github.com/mui-org/material-ui/blob/ffde9e/packages/material-ui/src/useAutocomplete/useAutocomplete.js
// The reason this is forked is to add support for filtering based on multiple fields:
// https://github.com/mui-org/material-ui/issues/20660

// https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
// Give up on IE11 support for this feature
function stripDiacritics(string: string) {
  return typeof string.normalize !== 'undefined'
    ? string.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    : string;
}

export interface CreateFilterOptionsConfig<T> {
  ignoreAccents?: boolean;
  ignoreCase?: boolean;
  limit?: number;
  matchFrom?: 'any' | 'start';
  stringify?: (option: T) => string | string[];
  trim?: boolean;
}

export function createFilterOptions<T>(
  config: CreateFilterOptionsConfig<T> = {},
): (options: T[], state: FilterOptionsState<T>) => T[] {
  const {
    ignoreAccents = true,
    ignoreCase = true,
    limit,
    matchFrom = 'any',
    stringify,
    trim = false,
  } = config;

  return (options, { inputValue, getOptionLabel }) => {
    let input = trim ? inputValue.trim() : inputValue;
    if (ignoreCase) {
      input = input.toLowerCase();
    }
    if (ignoreAccents) {
      input = stripDiacritics(input);
    }

    const filteredOptions = options.filter((option) => {
      let strings = (stringify || getOptionLabel)(option);
      const candidates = Array.isArray(strings) ? strings : [strings];

      return candidates.some((_candidate) => {
        let candidate = _candidate;
        if (ignoreCase) {
          candidate = candidate.toLowerCase();
        }
        if (ignoreAccents) {
          candidate = stripDiacritics(candidate);
        }

        return matchFrom === 'start'
          ? candidate.indexOf(input) === 0
          : candidate.indexOf(input) > -1;
      });
    });

    return typeof limit === 'number' ? filteredOptions.slice(0, limit) : filteredOptions;
  };
}
