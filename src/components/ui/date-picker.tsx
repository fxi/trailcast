'use client'
import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  minDate?: Date
  maxDate?: Date
}

export function DatePicker({ value, onChange, minDate, maxDate }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = new Date(value)

  const handleSelect = (d?: Date) => {
    if (!d) return
    onChange(d.toISOString().split('T')[0])
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-32 justify-between font-normal">
          {date.toLocaleDateString()}
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          fromDate={minDate}
          toDate={maxDate}
        />
      </PopoverContent>
    </Popover>
  )
}
