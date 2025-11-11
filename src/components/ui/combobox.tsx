"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Option = {
  value: string;
  label: string;
}

type ComboboxProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  allowCustomValue?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search...",
  noResultsText = "No results found.",
  allowCustomValue = true,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "");

  React.useEffect(() => {
    const matchingOption = options.find(option => option.value.toLowerCase() === value.toLowerCase());
    setInputValue(matchingOption?.label || value);
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const newValue = currentValue === value ? "" : currentValue;
    const matchingOption = options.find(option => option.value.toLowerCase() === newValue.toLowerCase());
    onChange(matchingOption?.value || newValue);
    setOpen(false)
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const manualInput = e.target.value;
      setInputValue(manualInput);
  }

  const handleInputBlur = () => {
    // If custom values are allowed, update the form with the current input value
    if (allowCustomValue) {
      const matchingOption = options.find(option => option.label.toLowerCase() === inputValue.toLowerCase());
      onChange(matchingOption?.value || inputValue);
    }
  }
  
  const filteredOptions = options.filter(option => option.label.toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? options.find((option) => option.value.toLowerCase() === value.toLowerCase())?.label ?? value
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <input
                placeholder={searchPlaceholder}
                onInput={handleInputChange}
                onBlur={handleInputBlur}
                value={inputValue}
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            {filteredOptions.length === 0 && allowCustomValue && inputValue ? (
                 <CommandItem
                    value={inputValue}
                    onSelect={handleSelect}
                 >
                    Agregar y seleccionar: "{inputValue}"
                </CommandItem>
            ) : <CommandEmpty>{noResultsText}</CommandEmpty>}
            <CommandGroup>
              {filteredOptions
                .map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
