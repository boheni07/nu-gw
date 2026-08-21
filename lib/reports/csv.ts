// Design Ref: §4.1 공용 CSV 빌더 — module-10
// 연차/근태/결재 3종 리포트가 전부 이 함수 하나만 재사용한다.
// 향후 진짜 .xlsx로 전환하더라도 이 파일만 교체하면 되도록 리포트별 로직과 분리해둔다.

export interface CsvColumn<T> {
  key: keyof T | ((row: T) => string | number);
  header: string;
}

function escapeCell(value: string | number): string {
  const str = String(value);
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** rows를 CSV 문자열로 변환한다. 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const BOM = "﻿";
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const value = typeof c.key === "function" ? c.key(row) : (row[c.key] as unknown as string | number);
        return escapeCell(value ?? "");
      })
      .join(",")
  );
  return BOM + [headerLine, ...lines].join("\n") + "\n";
}

/** CSV 다운로드 응답에 공통으로 쓰는 헤더. 파일명은 RFC 5987 인코딩으로 한글도 안전하게 전달한다. */
export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="report.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };
}
