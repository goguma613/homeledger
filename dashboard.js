// dashboard.js

// ─────────────────────────────────────────────────
// 1) 전역 변수 및 DOM 요소 참조
// ─────────────────────────────────────────────────
const dashYearSelect       = document.getElementById('dashYear');
const startMonthSelect     = document.getElementById('startMonth');
const endMonthSelect       = document.getElementById('endMonth');
const btnLoadDashboard     = document.getElementById('btnLoadDashboard');
const summaryBody          = document.getElementById('summaryBody');
const yearTotalEl          = document.getElementById('yearTotal');
const chartCanvas          = document.getElementById('chartCanvas');

// 새로 추가된 요소들
const bankFilterSelect     = document.getElementById('bankFilter'); // 은행(“bank”) 필터 드롭다운
const bankSummaryTbody     = document.querySelector('#bankSummary tbody');
const compareCanvas        = document.getElementById('compareChart');
const monthlyTxCountEl     = document.getElementById('monthlyTxCount');
const monthlyAvgAmountEl   = document.getElementById('monthlyAvgAmount');
const topTxTbody           = document.querySelector('#topTransactions tbody');
const bottomTxTbody        = document.querySelector('#bottomTransactions tbody');

// Chart.js 인스턴스 보관 변수
let expenseBarChart   = null;
let expenseTrendChart = null;

// ─────────────────────────────────────────────────
// 2) 페이지 로드 시 초기화: 연도 & 월 셀렉터, 차트 생성
// ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initDashYearSelector();     // 연도 선택 콤보박스 초기화
  initMonthSelectors();       // 시작월/종료월 콤보박스 초기화
  initBankFilter();           // 은행 필터 드롭다운 초기화
  initExpenseBarChart();      // 월별 지출 바 차트 초기화
  initExpenseTrendChart();    // 지출 추세 라인 차트 초기화

  // 기본적으로 현재 연도 전체(1월~12월) 데이터 로드
  loadDashboardData();
});

// ─────────────────────────────────────────────────
// 3) 연도 셀렉터 초기화 함수
// ─────────────────────────────────────────────────
function initDashYearSelector() {
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    const opt = document.createElement('option');
    opt.value = `${y}`;
    opt.textContent = `${y}년도`;
    dashYearSelect.appendChild(opt);
  }
  dashYearSelect.value = `${currentYear}`;
}

// ─────────────────────────────────────────────────
// 4) 월 셀렉터 초기화 함수 (시작월/종료월)
// ─────────────────────────────────────────────────
function initMonthSelectors() {
  for (let m = 1; m <= 12; m++) {
    const opt1 = document.createElement('option');
    opt1.value = `${m}`;
    opt1.textContent = `${m}월`;
    startMonthSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = `${m}`;
    opt2.textContent = `${m}월`;
    endMonthSelect.appendChild(opt2);
  }
  // 기본값: 1월~12월
  startMonthSelect.value = '1';
  endMonthSelect.value   = '12';
}

// ─────────────────────────────────────────────────
// 5) 은행 필터 드롭다운 초기화 함수
// ─────────────────────────────────────────────────
function initBankFilter() {
  // 초기에는 "전체"만 추가
  bankFilterSelect.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '전체';
  allOpt.textContent = '전체 은행';
  bankFilterSelect.appendChild(allOpt);

  // 필터 변경 시 테이블 리렌더링
  bankFilterSelect.addEventListener('change', () => {
    renderBankSummary(currentBankTotals);
  });
}

// ─────────────────────────────────────────────────
// 6) 숫자 3자리 콤마 포맷 함수 (유틸리티)
//    - num이 undefined 또는 null일 경우 '0' 반환
// ─────────────────────────────────────────────────
function formatNumber(num) {
  if (num === undefined || num === null) {
    return '0';
  }
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─────────────────────────────────────────────────
// 7) 월별 지출 바 차트 초기화 함수
// ─────────────────────────────────────────────────
function initExpenseBarChart() {
  const ctx = chartCanvas.getContext('2d');
  expenseBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
      datasets: [
        {
          label: '월별 지출 합계',
          data: Array(12).fill(0),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString() + '원';
            }
          }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────
// 8) 지출 추세 라인 차트 초기화 함수
// ─────────────────────────────────────────────────
function initExpenseTrendChart() {
  const ctx2 = compareCanvas.getContext('2d');
  expenseTrendChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
      datasets: [
        {
          label: '지출 추세',
          data: Array(12).fill(0),
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value.toLocaleString() + '원';
            }
          }
        }
      }
    }
  });
}

// ─────────────────────────────────────────────────
// 9) 지출 추세 차트 업데이트 함수
// ─────────────────────────────────────────────────
function updateExpenseTrendChart(labels, expenseArr) {
  if (!expenseTrendChart) return;
  expenseTrendChart.data.labels = labels;
  expenseTrendChart.data.datasets[0].data = expenseArr;
  expenseTrendChart.update();
}

// ─────────────────────────────────────────────────
// 10) 데이터 로드 버튼 클릭 시 호출될 함수
// ─────────────────────────────────────────────────
btnLoadDashboard.addEventListener('click', () => {
  loadDashboardData();
});

// ─────────────────────────────────────────────────
// 11) 전역 상태 저장 변수
// ─────────────────────────────────────────────────
let currentBankTotals = {}; // { "은행명": 합계, ... }

// ─────────────────────────────────────────────────
// 12) loadDashboardData 함수
//     - 선택된 연도, 시작월, 종료월 범위에 맞추어
//       "/data/{year}/{MM}.json" 파일을 모두 불러와서
//       combinedData 배열에 합친 뒤
//       ◼ 월별 지출 합계
//       ◼ 은행별 지출 합계
//       ◼ 거래 건수/평균 거래액
//       ◼ 지출 바 차트
//       ◼ 지출 추세 라인 차트
//       ◼ 상위/하위 지출 내역
//     를 모두 처리
// ─────────────────────────────────────────────────
async function loadDashboardData() {
  const selectedYear = dashYearSelect.value;
  const startMonth   = parseInt(startMonthSelect.value, 10);
  const endMonth     = parseInt(endMonthSelect.value, 10);

  if (startMonth > endMonth) {
    alert('시작월이 종료월보다 클 수 없습니다.');
    return;
  }

  try {
    // ❶ 선택된 월 파일들을 순회하며 fetch
    let combinedData = [];
    for (let m = startMonth; m <= endMonth; m++) {
      const mm = m.toString().padStart(2, '0');
      const filePath = `/data/${selectedYear}/${mm}.json`;

      try {
        const response = await fetch(filePath);
        if (!response.ok) {
          console.warn(`파일을 찾을 수 없습니다: ${filePath}`);
          continue;
        }
        const monthData = await response.json();
        if (Array.isArray(monthData.data)) {
          monthData.data.forEach(tx => {
            tx.__month = m;
            combinedData.push(tx);
          });
        } else {
          console.warn(`${filePath}의 데이터 형식이 배열이 아닙니다.`);
        }
      } catch (err) {
        console.error(`에러 발생 (${filePath}):`, err);
        continue;
      }
    }

    // ─────────────────────────────────────────────────
    // combinedData가 비어 있으면 데이터 없음 처리 후 초기화
    // ─────────────────────────────────────────────────
    if (combinedData.length === 0) {
      alert('선택한 기간에 해당하는 데이터가 없습니다.');
      resetAllDisplays();
      return;
    }

    // ─────────────────────────────────────────────────
    // ❷ 초기화: 전체 12개월(0~11) 배열 세팅 및 은행 합계 계산
    // ─────────────────────────────────────────────────
    const monthlyExpense = Array(12).fill(0);
    const monthlyCount   = Array(12).fill(0);
    const bankTotals     = {}; // { "은행명": 합계, ... }

    // 상위/하위 거래 내역 복사본
    const allTxCopy = [...combinedData];

    // combinedData 순회
    combinedData.forEach(tx => {
      const monthIdx = (typeof tx.__month === 'number') ? (tx.__month - 1) : 0;
      const amount   = Number(tx.amount) || 0;
      const bankName = tx.bank || '미분류';

      // 월별 거래 건수 및 지출 합계 누적
      monthlyCount[monthIdx]++;
      monthlyExpense[monthIdx] += amount;

      // 은행별 합계 누적
      if (!bankTotals[bankName]) {
        bankTotals[bankName] = 0;
      }
      bankTotals[bankName] += amount;
    });

    // ─────────────────────────────────────────────────
    // ❸ 선택된 기간 총합 계산 (startMonth-1 ~ endMonth-1)
    // ─────────────────────────────────────────────────
    let totalExpenseInPeriod = 0;
    for (let m = startMonth - 1; m <= endMonth - 1; m++) {
      totalExpenseInPeriod += monthlyExpense[m];
    }

    // ─────────────────────────────────────────────────
    // ❹ 월별 합계 테이블 업데이트 (선택한 구간)
    // ─────────────────────────────────────────────────
    summaryBody.innerHTML = '';
    for (let i = startMonth - 1; i < endMonth; i++) {
      const tr = document.createElement('tr');
      const tdMonth = document.createElement('td');
      const tdSum   = document.createElement('td');

      tdMonth.textContent = `${i + 1}월`;
      tdSum.textContent   = `${formatNumber(monthlyExpense[i])}원`;
      tr.append(tdMonth, tdSum);
      summaryBody.appendChild(tr);
    }
    yearTotalEl.textContent = `총 지출 합계: ${formatNumber(totalExpenseInPeriod)}원`;

    // ─────────────────────────────────────────────────
    // ❺ 지출 바 차트 업데이트
    // ─────────────────────────────────────────────────
    const barData = Array(12).fill(0);
    for (let m = startMonth - 1; m < endMonth; m++) {
      barData[m] = monthlyExpense[m];
    }
    if (expenseBarChart) {
      expenseBarChart.data.datasets[0].data = barData;
      expenseBarChart.update();
    }

    // ─────────────────────────────────────────────────
    // ❻ 은행 필터 드롭다운 목록 갱신
    // ─────────────────────────────────────────────────
    updateBankFilterOptions(bankTotals);

    // ─────────────────────────────────────────────────
    // ❼ 은행별 합계 테이블 렌더링 (필터 적용)
    // ─────────────────────────────────────────────────
    currentBankTotals = bankTotals;
    renderBankSummary(currentBankTotals);

    // ─────────────────────────────────────────────────
    // ❽ 거래 건수 & 평균 거래액 표시 (선택 구간)
    // ─────────────────────────────────────────────────
    let totalTxCount = 0;
    for (let m = startMonth - 1; m < endMonth; m++) {
      totalTxCount += monthlyCount[m];
    }
    const avgTxAmt = totalTxCount > 0
      ? Math.round(totalExpenseInPeriod / totalTxCount)
      : 0;
    monthlyTxCountEl.textContent   = `${totalTxCount}건`;
    monthlyAvgAmountEl.textContent = `${formatNumber(avgTxAmt)}원`;

    // ─────────────────────────────────────────────────
    // ❾ 지출 추세 라인 차트 업데이트
    // ─────────────────────────────────────────────────
    const labels           = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
    const expenseTrendData = Array(12).fill(0);
    for (let m = startMonth - 1; m < endMonth; m++) {
      expenseTrendData[m] = monthlyExpense[m];
    }
    updateExpenseTrendChart(labels, expenseTrendData);

    // ─────────────────────────────────────────────────
    // ❿ 상위/하위 지출 내역 구하기 & 테이블 채우기 (선택 구간)
    // ─────────────────────────────────────────────────
    allTxCopy.sort((a, b) => {
      const aVal = Number(a.amount) || 0;
      const bVal = Number(b.amount) || 0;
      return bVal - aVal; // 내림차순 정렬: 지출 큰 순
    });
    const top5    = allTxCopy.slice(0, 5);
    const bottom5 = allTxCopy.slice(-5).reverse();

    topTxTbody.innerHTML = '';
    top5.forEach(tx => {
      const tr = document.createElement('tr');
      const tdDate = document.createElement('td');
      const tdCat  = document.createElement('td');
      const tdAmt  = document.createElement('td');
      const tdMemo = document.createElement('td');

      const displayMonth = tx.__month ? tx.__month : '-';
      tdDate.textContent = `${selectedYear}년 ${displayMonth}월 ${tx.date}일`;
      tdCat.textContent  = tx.category;
      const safeAmt      = Number(tx.amount) || 0;
      tdAmt.textContent  = `${formatNumber(safeAmt)}원`;
      tdMemo.textContent = tx.memo || '-';

      tr.append(tdDate, tdCat, tdAmt, tdMemo);
      topTxTbody.appendChild(tr);
    });

    bottomTxTbody.innerHTML = '';
    bottom5.forEach(tx => {
      const tr = document.createElement('tr');
      const tdDate = document.createElement('td');
      const tdCat  = document.createElement('td');
      const tdAmt  = document.createElement('td');
      const tdMemo = document.createElement('td');

      const displayMonth = tx.__month ? tx.__month : '-';
      tdDate.textContent = `${selectedYear}년 ${displayMonth}월 ${tx.date}일`;
      tdCat.textContent  = tx.category;
      const safeAmt      = Number(tx.amount) || 0;
      tdAmt.textContent  = `${formatNumber(safeAmt)}원`;
      tdMemo.textContent = tx.memo || '-';

      tr.append(tdDate, tdCat, tdAmt, tdMemo);
      bottomTxTbody.appendChild(tr);
    });

  } catch (error) {
    console.error(error);
    alert('대시보드 데이터를 불러오는 중 오류가 발생했습니다.');
  }
}

// ─────────────────────────────────────────────────
// 13) 은행 필터 옵션 업데이트 함수
//     - bankTotals 객체에서 은행 목록을 읽어와 드롭다운에 추가
// ─────────────────────────────────────────────────
function updateBankFilterOptions(bankTotals) {
  bankFilterSelect.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '전체';
  allOpt.textContent = '전체 은행';
  bankFilterSelect.appendChild(allOpt);

  Object.keys(bankTotals).forEach(bankName => {
    const opt = document.createElement('option');
    opt.value = bankName;
    opt.textContent = bankName;
    bankFilterSelect.appendChild(opt);
  });
  bankFilterSelect.value = '전체';
}

// ─────────────────────────────────────────────────
// 14) 은행 합계 테이블 렌더링 함수
//     - 필터(전체/특정 은행) 적용
// ─────────────────────────────────────────────────
function renderBankSummary(bankTotals) {
  const selectedBank = bankFilterSelect.value;
  bankSummaryTbody.innerHTML = '';

  if (selectedBank === '전체') {
    Object.entries(bankTotals).forEach(([bankName, totalAmt]) => {
      const tr = document.createElement('tr');
      const tdBankName = document.createElement('td');
      const tdBankAmt  = document.createElement('td');
      tdBankName.textContent = bankName;
      tdBankAmt.textContent  = `${formatNumber(totalAmt)}원`;
      tr.append(tdBankName, tdBankAmt);
      bankSummaryTbody.appendChild(tr);
    });
  } else {
    const amt = bankTotals[selectedBank] || 0;
    const tr = document.createElement('tr');
    const tdBankName = document.createElement('td');
    const tdBankAmt  = document.createElement('td');
    tdBankName.textContent = selectedBank;
    tdBankAmt.textContent  = `${formatNumber(amt)}원`;
    tr.append(tdBankName, tdBankAmt);
    bankSummaryTbody.appendChild(tr);
  }
}

// ─────────────────────────────────────────────────
// 15) 모든 디스플레이 요소 초기화 함수
//     - 데이터 없을 때 각 영역을 초기화
// ─────────────────────────────────────────────────
function resetAllDisplays() {
  summaryBody.innerHTML     = '';
  yearTotalEl.textContent   = '총 지출 합계: 0원';
  if (expenseBarChart) {
    expenseBarChart.data.datasets[0].data = Array(12).fill(0);
    expenseBarChart.update();
  }
  bankFilterSelect.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = '전체';
  allOpt.textContent = '전체 은행';
  bankFilterSelect.appendChild(allOpt);
  bankSummaryTbody.innerHTML = '';
  monthlyTxCountEl.textContent   = '0건';
  monthlyAvgAmountEl.textContent = '0원';
  updateExpenseTrendChart(
    Array.from({ length: 12 }, (_, i) => `${i + 1}월`),
    Array(12).fill(0)
  );
  topTxTbody.innerHTML    = '';
  bottomTxTbody.innerHTML = '';
}
