"use client";

// Design Ref: 표준 입력항목(날짜) 실시간 자동변환 — module-18
// 네이티브 <input type="date">는 값은 항상 YYYY-MM-DD이지만 "표시" 형식이 OS/브라우저 로캘을 따라
// MM/DD/YYYY 등으로 보일 수 있다. 항상 YYYY-MM-DD로 보이도록 텍스트 입력을 기본으로 하고,
// 달력 아이콘을 누르면 네이티브 date picker(값 동기화용)를 띄워준다.
import { useRef } from "react";
import { formatDateDigits } from "@/lib/ui/format";
import { CalendarIcon } from "@/lib/ui/icons";

export default function DateInput({
  value,
  onChange,
  className = "input",
  required,
  min,
  max,
  id,
  name,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  required?: boolean;
  min?: string;
  max?: string;
  id?: string;
  name?: string;
}) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        name={name}
        className={className}
        type="text"
        inputMode="numeric"
        placeholder="YYYY-MM-DD"
        value={value}
        onChange={(e) => {
          let next = formatDateDigits(e.target.value);
          if (next.length === 10) {
            if (min && next < min) next = min;
            if (max && next > max) next = max;
          }
          onChange(next);
        }}
        maxLength={10}
        required={required}
        style={{ paddingRight: 34, width: "100%" }}
      />
      <button
        type="button"
        className="icon-btn"
        style={{ position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)", width: 26, height: 26 }}
        onClick={() => hiddenRef.current?.showPicker?.()}
        aria-label="달력에서 선택"
        tabIndex={-1}
      >
        <CalendarIcon size={14} />
      </button>
      {/* 달력 아이콘 클릭 시에만 사용하는 숨김 네이티브 picker — 값 선택 시 텍스트 값으로 동기화한다. */}
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
