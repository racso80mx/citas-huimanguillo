'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type Option = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
  content?: React.ReactNode;
};

type ComboboxProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  allowCustomValue?: boolean;
  disabled?: boolean;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  noResultsText = 'No results found.',
  allowCustomValue = false,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(o => o.value === currentValue);
    if (selectedOption?.disabled) return;
    
    onChange(currentValue === value ? '' : currentValue);
    setOpen(false);
    setInputValue('');
  };
  
  // Custom filter logic to handle cases where content might be present
  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    const term = inputValue.toLowerCase();
    return options.filter(option => 
      (option.keywords || option.label).toLowerCase().includes(term)
    );
  }, [options, inputValue]);

  const selectedLabel = value
    ? options.find((option) => option.value === value)?.label ?? value
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-11"
          disabled={disabled}
        >
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] w-full md:max-w-[700px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>{noResultsText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                  disabled={option.disabled}
                  className={cn(
                    "cursor-pointer",
                    option.disabled ? "opacity-50 cursor-not-allowed" : ""
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    {option.content || <span>{option.label}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
