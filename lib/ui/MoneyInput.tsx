"use client";

// Design Ref: 표준 입력항목(금액) 실시간 자동변환 — module-16
// type="number"은 콤마 표시가 불가능하므로 text+inputMode=numeric으로 구현하고, 값은 숫자로 주고받는다.
import { formatWithCommas, parseFormattedNumber } from "@/lib/ui/format";

export default function MoneyInput({
  value,
  onChange,
  onBlur,
  className = "input",
  placeholder = "0",
  suffix,
  style,
}: {
  value: number;
  onChange: (next: number) => void;
  /** 인라인 편집 테이블 등에서 포커스가 벗어날 때 저장 요청을 보내고 싶을 때 사용(선택) */
  onBlur?: () => void;
  className?: string;
  placeholder?: string;
  /** 입력창 오른쪽에 "원" 등 단위를 붙이고 싶을 때 사용(선택) */
  suffix?: string;
  style?: React.CSSProperties;
}) {
  const display = value ? formatWithCommas(String(value)) : "";

  const input = (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(parseFormattedNumber(e.target.value))}
      onBlur={onBlur}
      style={suffix ? { paddingRight: 32, ...style } : style}
    />
  );

  if (!suffix) return input;
  return (
    <div style={{ position: "relative" }}>
      {input}
      <span
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 12.5,
          color: "var(--text-faint)",
          pointerEvents: "none",
        }}
      >
        {suffix}
      </span>
    </div>
  );
}
