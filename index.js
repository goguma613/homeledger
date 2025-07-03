// ===============================================
// index.js
// ===============================================

// ==============================
// HTML 요소 참조 (DOM)
// ==============================
const selectYear     = document.getElementById('selectYear');
const selectMonth    = document.getElementById('selectMonth');
const btnLoad        = document.getElementById('btnLoad');
const btnCopyNext    = document.getElementById('btnCopyNext');
const btnToggleEdit  = document.getElementById('btnToggleEdit');
const btnSave        = document.getElementById('btnSave');
const btnAddSection  = document.getElementById('btnAddSection');
const cardsContainer = document.getElementById('cardsContainer');
const countValue     = document.getElementById('countValue');

// 커스텀 확정 모달 요소
const customModal    = document.getElementById('customModal');
const modalMessage   = document.getElementById('modalMessage');
const modalOk        = document.getElementById('modalOk');
const modalCancel    = document.getElementById('modalCancel');

// 섹션 추가 모달 요소
const sectionModal       = document.getElementById('sectionModal');
const sectionTitleInput   = document.getElementById('sectionTitle');
const sectionAccountInput = document.getElementById('sectionAccount');
const sectionOkBtn        = document.getElementById('sectionOk');
const sectionCancelBtn    = document.getElementById('sectionCancel');

// 토스트 알림 요소
const toastEl        = document.getElementById('toast');

// ==============================
// 전역 변수
// ==============================
let currentYear    = new Date().getFullYear();
let currentMonth   = new Date().getMonth() + 1;
let ledgerData     = [];    // [{ category, bank, date, amount, done, markedForDeletion, excluded }, ...]
let backupData     = [];    // 편집 모드 진입 시점 데이터 백업용
let sectionsData   = {};    // { category: account, ... }
let isEditing      = false;
let msnry = null;           // Masonry 인스턴스 저장
let draggedRowIdx = null;   // 드래그된 행의 ledgerData 인덱스

// ==============================
// updateAll: 화면 갱신 + (편집 모드가 아닐 때만) 자동 저장
// ==============================
function updateAll() {
  renderCards();
  if (!isEditing) {
    autoSave();
  }
}

// ==============================
// showConfirm: 커스텀 확정창 (Promise<boolean> 반환)
// ==============================
function showConfirm(message) {
  return new Promise(resolve => {
    modalMessage.textContent = message;
    customModal.classList.remove('hidden');

    function onOk() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }
    function cleanup() {
      modalOk.removeEventListener('click', onOk);
      modalCancel.removeEventListener('click', onCancel);
      customModal.classList.add('hidden');
    }

    modalOk.addEventListener('click', onOk);
    modalCancel.addEventListener('click', onCancel);
  });
}

// ==============================
// showToast: 토스트 알림 표시
// ==============================
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastEl.classList.add('visible');

  // 2초 뒤 사라지도록
  setTimeout(() => {
    toastEl.classList.remove('visible');
    setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 300);
  }, 2000);
}

// ==============================
// 섹션 추가 모달 열기 / 닫기 / 저장
// ==============================
function openSectionModal() {
  sectionTitleInput.value = '';
  sectionAccountInput.value = '';
  sectionModal.classList.remove('hidden');
}

function closeSectionModal() {
  sectionModal.classList.add('hidden');
}

function saveNewSection() {
  const title = sectionTitleInput.value.trim();
  const account = sectionAccountInput.value.trim();

  if (!title) {
    alert('섹션 제목을 입력해 주세요.');
    return;
  }
  if (sectionsData.hasOwnProperty(title)) {
    alert('이미 동일한 섹션이 존재합니다.');
    return;
  }

  // 새로운 섹션 추가
  sectionsData[title] = account;
  updateAll();
  closeSectionModal();
}

// ==============================
// 초기화: 연도/월 드롭다운 채우기
// ==============================
function initYearMonthSelectors() {
  const startYear = currentYear - 5;
  const endYear   = currentYear + 1;

  // 연도 옵션 생성 (startYear ~ endYear)
  for (let y = startYear; y <= endYear; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}년`;
    if (y === currentYear) opt.selected = true;
    selectYear.appendChild(opt);
  }

  // 월 옵션 생성 (1월 ~ 12월)
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = (m < 10 ? '0' + m : m) + '월';
    if (m === currentMonth) opt.selected = true;
    selectMonth.appendChild(opt);
  }
}

// ==============================
// 금액 입력란(숫자만 허용+쉼표 자동 적용) 헬퍼 함수
// ==============================
function formatNumberWithCommas(numStr) {
  const numeric = numStr.replace(/,/g, '').replace(/[^0-9]/g, '');
  if (!numeric) return '';
  const n = parseInt(numeric, 10);
  if (isNaN(n)) return '';
  return n.toLocaleString();
}

// ==============================
// 항목 순서 이동: 버튼식 이동 함수 (위/아래 버튼 클릭 시 호출)
// - idx: ledgerData 배열상의 인덱스
// - direction: 'up' 또는 'down'
// - 같은 카테고리 내에서만 이동
// ==============================
function moveRowByButton(idx, direction) {
  const item = ledgerData[idx];
  const cat = item.category || '미분류';

  // 동일 카테고리 내 인덱스 배열 생성
  const sameCatIndices = ledgerData
    .map((x, i) => ({ cat: x.category || '미분류', i }))
    .filter(x => x.cat === cat)
    .map(x => x.i);

  const posInCat = sameCatIndices.indexOf(idx);
  if (posInCat === -1) return;

  let targetPosInCat;
  if (direction === 'up') {
    targetPosInCat = posInCat - 1;
  } else if (direction === 'down') {
    targetPosInCat = posInCat + 1;
  }
  if (targetPosInCat < 0 || targetPosInCat >= sameCatIndices.length) return;

  const targetIdx = sameCatIndices[targetPosInCat];

  // ledgerData에서 실제 위치 교환
  const temp = ledgerData[idx];
  ledgerData[idx] = ledgerData[targetIdx];
  ledgerData[targetIdx] = temp;

  updateAll();
}

// ==============================
// 렌더링: sectionsData 키와 ledgerData 카테고리의 합집합을 순회
// ==============================
function renderCards() {
  cardsContainer.innerHTML = '';
  const groupMap = {};

  // 1) ledgerData에 있는 아이템을 카테고리별로 그룹화
  ledgerData.forEach((item, idx) => {
    const cat = item.category || '미분류';
    if (!groupMap[cat]) groupMap[cat] = [];
    groupMap[cat].push({ ...item, __idx: idx });
  });

  // 2) sectionsData의 카테고리도 빈 배열로 추가 (그룹화)
  Object.keys(sectionsData).forEach(cat => {
    if (!groupMap[cat]) {
      groupMap[cat] = [];
    }
  });

  // 3) 그룹화된 카테고리별로 카드 생성
  Object.keys(groupMap).forEach(cat => {
    const arr = groupMap[cat];
    const card = document.createElement('div');
    card.className = 'card' + (isEditing ? ' editing' : '');

    // ─── 카드 헤더 ─────────────────────
    const h2 = document.createElement('h2');

    if (isEditing) {
      // 편집 모드: 카테고리명 input
      const categoryInput = document.createElement('input');
      categoryInput.type = 'text';
      categoryInput.value = cat;
      categoryInput.className = 'category-input';
      categoryInput.addEventListener('blur', () => {
        const newCat = categoryInput.value.trim() || '미분류';
        if (newCat === cat) return;
        // ledgerData 및 sectionsData의 키를 변경
        const oldAccount = sectionsData[cat] || '';
        delete sectionsData[cat];
        sectionsData[newCat] = oldAccount;
        ledgerData.forEach(item => {
          if (item.category === cat) item.category = newCat;
        });
        updateAll();
      });
      h2.appendChild(categoryInput);
    } else {
      h2.textContent = cat;
    }

    // 미완료 개수 표시
    const incompleteCount = ledgerData.filter(x => !x.done && x.category === cat).length;
    const spanStatus = document.createElement('span');
    spanStatus.className = 'status';
    spanStatus.textContent = `미확인: ${incompleteCount}개`;
    h2.appendChild(spanStatus);

    // 편집 모드일 때만 “항목 추가” 버튼
    const btnAddItem = document.createElement('button');
    btnAddItem.textContent = '항목 추가';
    btnAddItem.className = 'btnAddItem';
    btnAddItem.disabled = !isEditing;
    btnAddItem.addEventListener('click', () => {
      btnAddItem.disabled = true;
      ledgerData.push({
        category: cat,
        bank: '',
        date: '',
        amount: '',
        done: false,
        markedForDeletion: false,
        excluded: false,
        memo: ''    // ★ 새로 추가
      });
      updateAll();
      btnAddItem.disabled = false;
    });    
    h2.appendChild(btnAddItem);

    card.appendChild(h2);

    // ─── 계좌 정보 ─────────────────────
    const divAcc = document.createElement('div');
    divAcc.className = 'account-info';
    if (isEditing) {
      // 편집 모드: input으로 계좌 수정
      const accountInput = document.createElement('input');
      accountInput.type = 'text';
      accountInput.className = 'account-input';
      accountInput.value = sectionsData[cat] || '';
      accountInput.placeholder = '계좌 입력';
      accountInput.addEventListener('change', () => {
        sectionsData[cat] = accountInput.value.trim();
      });
      divAcc.appendChild(accountInput);
    } else {
      // 읽기 모드: sectionsData에 값이 있을 때만 “계좌: xxx” 표시
      if (sectionsData[cat]) {
        divAcc.textContent = `계좌: ${sectionsData[cat]}`;
      } else {
        divAcc.textContent = '';
      }
    }
    card.appendChild(divAcc);

    // ─── 카드 내부 테이블 ─────────────────
    const table = document.createElement('table');

    // 1) 테이블 헤더
    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    const headersWithExclude = isEditing
      ? ['은행/항목', '날짜', '금액', '순서 이동', '삭제', '계산 제외', '메모']
      : ['은행/항목', '날짜', '금액', '완료', '계산 제외', '메모'];
    headersWithExclude.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      trHead.appendChild(th);
    });

    thead.appendChild(trHead);
    table.append(thead);

    // 2) 테이블 본문
    const tbody = document.createElement('tbody');
    tbody.dataset.category = cat;

    arr.forEach(itemWithIdx => {
      const idx = itemWithIdx.__idx;
      const item = ledgerData[idx];

      const tr = document.createElement('tr');
      tr.draggable = true;          // 편집 모드 여부와 상관없이 항상 드래그 허용
      tr.dataset.idx = idx;

      // ── dragstart 이벤트 ─────────────────
      tr.addEventListener('dragstart', e => {
        draggedRowIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      // dragenter: 항상 preventDefault()
      tr.addEventListener('dragenter', e => e.preventDefault());
      // dragover: 항상 preventDefault()
      tr.addEventListener('dragover', e => e.preventDefault());
      // drop: 순서 교환 로직 (전체 렌더링 없이 <tr>만 이동)
      tr.addEventListener('drop', e => {
        e.preventDefault();
      
        const targetIdx = parseInt(tr.dataset.idx, 10);
      
        // draggedRowIdx가 제대로 설정되어 있는지 확인
        if (draggedRowIdx === null) {
          draggedRowIdx = null;
          return;
        }
        if (targetIdx === draggedRowIdx) {
          // 같은 위치라면 아무 작업 없이 초기화
          draggedRowIdx = null;
          return;
        }
      
        // 같은 카테고리 내에서만 이동 허용
        const draggedCat = ledgerData[draggedRowIdx].category || '미분류';
        const targetCat  = ledgerData[targetIdx].category   || '미분류';
        if (draggedCat !== targetCat) {
          // 다른 카테고리라면 무시
          draggedRowIdx = null;
          return;
        }
      
        // 같은 카테고리 내 인덱스 배열 생성
        const sameCatIndices = ledgerData
          .map((x, i) => ({ cat: x.category || '미분류', i }))
          .filter(x => x.cat === draggedCat)
          .map(x => x.i);
      
        // (1) 드래그된 항목과 타겟 항목의 카테고리 내 상대 위치 계산
        const posDraggedInCat = sameCatIndices.indexOf(draggedRowIdx);
        const posTargetInCat  = sameCatIndices.indexOf(targetIdx);
        if (posDraggedInCat === -1 || posTargetInCat === -1) {
          draggedRowIdx = null;
          return;
        }
      
        // (2) sameCatIndices 배열을 복제하여 newOrderInCat 생성
        const newOrderInCat = [...sameCatIndices];
        // (2-a) 드래그된 항목 먼저 제거
        newOrderInCat.splice(posDraggedInCat, 1);
      
        // (2-b) 새로운 삽입 위치 계산
        //      - 만약 드래그된 항목이 원래 타겟보다 '위에' 있었으면(=posDraggedInCat < posTargetInCat),
        //        제거 후 삽입 위치 인덱스를 하나 줄여야 "타겟의 바로 위"가 된다.
        let insertPos = posTargetInCat;
        if (posDraggedInCat < posTargetInCat) {
          insertPos = posTargetInCat - 1;
        }
        // (2-c) 드래그된 항목 인덱스를 그 위치에 삽입
        newOrderInCat.splice(insertPos, 0, draggedRowIdx);
      
        // (3) ledgerData 내부 순서를 newOrderInCat 순서대로 재배치
        const originalLedger = [...ledgerData];
        newOrderInCat.forEach((origIdx, newPos) => {
          ledgerData[ origIdx ] = originalLedger[ sameCatIndices[newPos] ];
        });
      
        // (4) DOM 상에서도 <tr> 요소를 “target 행의 바로 위”로 이동
        const draggedElem = cardsContainer.querySelector(`tr[data-idx="${draggedRowIdx}"]`);
        const targetElem  = cardsContainer.querySelector(`tr[data-idx="${targetIdx}"]`);
        if (draggedElem && targetElem && draggedElem !== targetElem) {
          const parentTbody = targetElem.parentNode;
          parentTbody.insertBefore(draggedElem, targetElem);
        }
      
        // (5) 드래그 상태 초기화, 비편집 모드면 자동저장 호출
        draggedRowIdx = null;
        if (!isEditing) {
          autoSave();
        }
      });

      // (a) 은행/항목 열
      const tdBank = document.createElement('td');
      const inputBank = document.createElement('input');
      inputBank.type = 'text';
      inputBank.value = item.bank;
      inputBank.placeholder = '은행명 또는 항목';
      inputBank.disabled = false;  // 항상 수정 가능
      inputBank.addEventListener('change', () => {
        ledgerData[idx].bank = inputBank.value;
        if (!isEditing) autoSave();
      });
      tdBank.appendChild(inputBank);

      // (b) 날짜 열
      const tdDate = document.createElement('td');
      const inputDate = document.createElement('input');
      inputDate.type = 'number';
      inputDate.value = item.date;
      inputDate.min = 1;
      inputDate.max = 31;
      inputDate.placeholder = '일';
      inputDate.disabled = false;  // 항상 수정 가능
      inputDate.addEventListener('change', () => {
        ledgerData[idx].date = inputDate.value;
        if (!isEditing) autoSave();
      });
      tdDate.appendChild(inputDate);

      // (c) 금액 열
      const tdAmt = document.createElement('td');
      const inputAmt = document.createElement('input');
      inputAmt.type = 'text';
      inputAmt.value = formatNumberWithCommas(item.amount);
      inputAmt.placeholder = '0';
      inputAmt.disabled = false;  // 항상 수정 가능
      inputAmt.addEventListener('input', () => {
        inputAmt.value = inputAmt.value.replace(/[^0-9]/g, '');
      });
      inputAmt.addEventListener('focus', () => {
        inputAmt.value = item.amount;
      });
      inputAmt.addEventListener('blur', () => {
        const cleaned = inputAmt.value.replace(/,/g, '').replace(/[^0-9]/g, '');
        ledgerData[idx].amount = cleaned;
        inputAmt.value = formatNumberWithCommas(cleaned);
        if (!isEditing) autoSave();
      });
      tdAmt.appendChild(inputAmt);

      tr.append(tdBank, tdDate, tdAmt);

      // 순서 이동 / 삭제 / 완료 열
      if (isEditing) {
        // 순서 이동(↑/↓)
        const tdMove = document.createElement('td');
        tdMove.style.whiteSpace = 'nowrap';

        const btnUp = document.createElement('button');
        btnUp.textContent = '↑';
        btnUp.title = '위로 이동';
        btnUp.style.margin = '0 2px';
        btnUp.addEventListener('click', () => moveRowByButton(idx, 'up'));

        const btnDown = document.createElement('button');
        btnDown.textContent = '↓';
        btnDown.title = '아래로 이동';
        btnDown.style.margin = '0 2px';
        btnDown.addEventListener('click', () => moveRowByButton(idx, 'down'));

        tdMove.append(btnUp, btnDown);
        tr.appendChild(tdMove);

        // 삭제 체크박스
        const tdDel = document.createElement('td');
        const chkDel = document.createElement('input');
        chkDel.type = 'checkbox';
        chkDel.className = 'del-checkbox';
        chkDel.checked = !!item.markedForDeletion;
        chkDel.addEventListener('change', () => {
          ledgerData[idx].markedForDeletion = chkDel.checked;
          // ① 체크박스 누르면 즉시 행 회색 처리
          if (chkDel.checked) {
            tr.classList.add('deleted-row');
          } else {
            tr.classList.remove('deleted-row');
          }
          // ② (원한다면) 화면에서 완전히 사라지게 하려면 아래 주석 해제
          // if (chkDel.checked) tr.style.display = 'none';
          // else tr.style.display = '';

          // ③ 필요하다면 바로 화면 갱신 (회색 처리 외 다른 변화가 필요할 때)
          // renderCards();
        });
        // ④ 페이지 로드 시, 이미 markedForDeletion=true인 경우 회색 처리
          if (item.markedForDeletion) {
            tr.classList.add('deleted-row');
            // tr.style.display = 'none'; // 사라지게 할 때
          }
        }else {
        // 완료 체크박스
        const tdDone = document.createElement('td');
        const inputDone = document.createElement('input');
        inputDone.type = 'checkbox';
        inputDone.checked = item.done;
        inputDone.disabled = false;
        inputDone.addEventListener('change', () => {
          ledgerData[idx].done = inputDone.checked;
          // 완료 상태 토글 시에도 깜빡임 없이 바로 카운트만 갱신
          const totalIncomplete = ledgerData.filter(x => !x.done && !x.markedForDeletion).length;
          countValue.textContent = totalIncomplete;
          autoSave();
        });
        tdDone.appendChild(inputDone);
        tr.appendChild(tdDone);
      }

      // ✨ 계산 제외 체크박스
      const tdExclude = document.createElement('td');
      const chkExclude = document.createElement('input');
      chkExclude.type = 'checkbox';
      chkExclude.checked = !!item.excluded;
      chkExclude.addEventListener('change', () => {
        // excluded 상태 토글
        ledgerData[idx].excluded = chkExclude.checked;
        // 깜빡임 없이 해당 카드의 합계만 업데이트
        updateCardSum(cat);
        // 비편집 모드라면 자동저장
        if (!isEditing) autoSave();
      });
      tdExclude.appendChild(chkExclude);
      tr.appendChild(tdExclude);

      // ─── 새로 추가: “메모” <td> ─────────────────
      const tdMemo = document.createElement('td');
      const inputMemo = document.createElement('textarea');
      inputMemo.value = item.memo || '';
      inputMemo.placeholder = '메모 입력';
      inputMemo.rows = 1;
      inputMemo.style.width = '100%';
      inputMemo.style.resize = 'vertical';  // 세로로만 조절 가능
      inputMemo.addEventListener('input', () => {
        ledgerData[idx].memo = inputMemo.value;
        // 실시간 자동저장: 편집 모드가 아닐 때만 autoSave()
        if (!isEditing) autoSave();
      });
      tdMemo.appendChild(inputMemo);
      tr.appendChild(tdMemo);
      
      tbody.appendChild(tr);
    });

    table.append(tbody);

    // ─── 테이블 합계 행 ─────────────────────
    const tfoot = document.createElement('tfoot');
    const trFoot = document.createElement('tr');
    trFoot.className = 'total-row';
    const tdLabel = document.createElement('td');
    tdLabel.colSpan = 2;
    tdLabel.textContent = '합계';

    // excluded를 반영한 합계 계산
    const sumForCat = arr.reduce((acc, x) => {
      return x.excluded ? acc : acc + (parseInt(x.amount) || 0);
    }, 0);

    const tdSum = document.createElement('td');
    tdSum.textContent = `${sumForCat.toLocaleString()}원`;
    tdSum.colSpan = 4; // “은행/날짜/금액/완료(또는 삭제)” 열을 포함한 colspan

    trFoot.append(tdLabel, tdSum);
    tfoot.append(trFoot);
    table.append(tfoot);

    card.appendChild(table);
    cardsContainer.appendChild(card);
  });

  // 전체 미완료 개수 갱신 (삭제 마킹된 항목 제외)
  const totalIncomplete = ledgerData.filter(x => !x.done && !x.markedForDeletion).length;
  countValue.textContent = totalIncomplete;

  // ─── Masonry 레이아웃 처리 ─────────────────────
  if (isEditing) {
    // 편집 모드인 경우: Masonry 해제
    if (msnry) {
      msnry.destroy();
      msnry = null;
    }
    return;
  }

  // 비편집 모드: Masonry 초기화 또는 레이아웃 갱신
  setTimeout(() => {
    if (msnry) {
      msnry.reloadItems();
      msnry.layout();
    } else {
      msnry = new Masonry(cardsContainer, {
        itemSelector: '.card',
        columnWidth: '.card',
        percentPosition: true,
        gutter: 20,
        transitionDuration: '0.3s'
      });
    }
  }, 50);
}

// ==============================
// 특정 카테고리 카드의 합계만 업데이트 (깜빡임 없이)  
// - cat: 업데이트할 카드의 카테고리 이름
// ==============================
function updateCardSum(cat) {
  // (1) 해당 카테고리의 카드 요소 찾기
  const allRows = Array.from(cardsContainer.querySelectorAll(`.card`))
    .filter(card => {
      const h2 = card.querySelector('h2');
      return h2 && h2.textContent.startsWith(cat);
    });
  if (allRows.length === 0) return;
  const card = allRows[0];

  // ledgerData에서 해당 카테고리 데이터만 골라 합계
  const sumForCat = ledgerData
    .filter(x => x.category === cat)
    .reduce((acc, x) => {
      return x.excluded ? acc : acc + (parseInt(x.amount) || 0);
    }, 0);

  // (2) 카드 내 tfoot의 합계 셀(tdSum) 찾기
  const tdSum = card.querySelector('tfoot .total-row td:nth-child(2)');
  if (tdSum) {
    tdSum.textContent = `${sumForCat.toLocaleString()}원`;
  }
}

// ==============================
// 편집 모드 토글
// ==============================
async function toggleEditMode() {
  if (!isEditing) {
    backupData = JSON.parse(JSON.stringify(ledgerData));
    isEditing = true;
    btnToggleEdit.textContent = '취소';
    renderCards();
  } else {
    const ok = await showConfirm('편집을 취소하고 원래 상태로 되돌리시겠습니까?');
    if (!ok) return;
    ledgerData = JSON.parse(JSON.stringify(backupData));
    isEditing = false;
    btnToggleEdit.textContent = '편집 모드';
    renderCards();
  }
}

// ==============================
// 편집 모드 “저장 및 완료” 클릭
// ==============================
async function applyEditsAndSave() {
  const ok = await showConfirm('편집 모드를 종료하고 변경사항을 저장하시겠습니까?');
  if (!ok) return;

  // markedForDeletion이 true인 항목 제거
  ledgerData = ledgerData.filter(item => !item.markedForDeletion);
  ledgerData.forEach(item => delete item.markedForDeletion);
  isEditing = false;
  btnToggleEdit.textContent = '편집 모드';
  renderCards();
  await saveToServer();
  showToast('변경사항이 저장되었습니다.');
}

// ==============================
// 자동저장 기능 (개선된 버전)
// ==============================
let autoSaveTimer = null;
let isSaving = false;

function autoSave() {
  if (isEditing) return;                // 편집 모드에서는 자동저장 비활성화
  if (autoSaveTimer) clearTimeout(autoSaveTimer);

  // 마지막 변경 후 1.5초가 지나면 saveToServer() 호출
  autoSaveTimer = setTimeout(async () => {
    if (isSaving) return;               // 이미 저장 중이면 중복 방지
    try {
      isSaving = true;
      await saveToServer();
      showToast('자동저장되었습니다.');
    } catch (e) {
      console.error('자동저장 실패:', e);
      showToast('자동저장 실패');
    } finally {
      isSaving = false;
    }
  }, 1500);
}

// ==============================
// 서버에서 로드
// ==============================
function loadFromServer(year, month) {
  ledgerData = [];
  sectionsData = {};
  renderCards();

  btnLoad.disabled = true;
  const params = new URLSearchParams({ year, month });
  fetch(`api/load_ledger.php?${params.toString()}`)
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        // (1) ledgerData 복원: markedForDeletion과 excluded 초기화
        ledgerData = json.data.map(item => ({
          // ← 반드시 ...item 으로 펼쳐주어야, 모든 필드(category, bank, date, amount, done, excluded 등)가 유지됩니다.
          ...item,
          markedForDeletion: false,
          excluded: item.excluded || false
        }));

        // (2) 섹션 정보 복원
        if (json.sections && typeof json.sections === 'object') {
          sectionsData = json.sections;
        } else {
          // 구버전(섹션 필드가 없던 경우): ledgerData에 있는 카테고리로만 빈 계좌 생성
          ledgerData.forEach(item => {
            if (!sectionsData.hasOwnProperty(item.category)) {
              sectionsData[item.category] = '';
            }
          });
        }
      } else {
        ledgerData = [];
        sectionsData = {};
      }
      renderCards();
    })
    .catch(err => {
      console.error('불러오기 실패:', err);
      ledgerData = [];
      sectionsData = {};
      renderCards();
    })
    .finally(() => {
      btnLoad.disabled = false;
    });
}

// ==============================
// 서버에 저장 (Promise 반환)
// ==============================
function saveToServer(customYear, customMonth) {
  const year  = customYear  || selectYear.value;
  const month = (customMonth || selectMonth.value).padStart(2, '0');

  // payload에 ledgerData(모든 필드 포함)와 sectionsData를 함께 전송
  const payload = {
    year,
    month,
    data: ledgerData,
    sections: sectionsData   // 섹션 정보 전체를 함께 전송
  };

  btnSave.disabled = true;
  return fetch('api/save_ledger.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(json => {
      if (!json.success) {
        // 서버 응답이 success=false인 경우
        console.error('저장 실패:', json.error);
        showToast(`저장 실패: ${json.error}`);
        return Promise.reject(new Error(json.error));
      } else {
        // 정상 저장
        return json;
      }
    })
    .catch(err => {
      // 네트워크 오류 혹은 위 reject된 경우 모두 여기로
      console.error('저장 중 오류:', err);
      showToast('저장 중 오류가 발생했습니다.');
      return Promise.reject(err);
    })
    .finally(() => {
      btnSave.disabled = false;
    });
}

// ==============================
// “다음 달 복사” 기능
// ==============================
async function copyToNextMonth() {
  const year  = parseInt(selectYear.value, 10);
  const month = parseInt(selectMonth.value, 10);
  let nextYear  = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextYear += 1;
    nextMonth = 1;
  }

  btnCopyNext.disabled = true;
  const paramsNext = new URLSearchParams({ year: nextYear, month: String(nextMonth).padStart(2, '0') });
  let proceed = true;
  try {
    const res = await fetch(`api/load_ledger.php?${paramsNext.toString()}`);
    const json = await res.json();
    // 이미 다음 달 데이터가 있으면 덮어쓸지 물어봄
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      proceed = await showConfirm('다음 달 데이터가 이미 존재합니다.\n덮어쓰시겠습니까?');
    }
  } catch (e) {
    console.error('다음 달 데이터 조회 실패:', e);
  }

  if (proceed) {
    await saveToServer(nextYear.toString(), String(nextMonth).padStart(2, '0'));
    showToast(`${year}년 ${month}월 데이터를 ${nextYear}년 ${nextMonth}월로 복사했습니다.`);
  }

  btnCopyNext.disabled = false;
}

// ==============================
// 버튼 이벤트 리스너 등록
// ==============================
btnLoad.addEventListener('click', () => {
  const year  = selectYear.value;
  const month = String(selectMonth.value).padStart(2, '0');
  currentYear  = parseInt(year, 10);
  currentMonth = parseInt(month, 10);
  loadFromServer(year, month);
});
btnCopyNext.addEventListener('click', () => {
  copyToNextMonth();
});
btnToggleEdit.addEventListener('click', () => {
  toggleEditMode();
});
btnSave.addEventListener('click', () => {
  if (isEditing) {
    applyEditsAndSave();
  } else {
    saveToServer()
      .then(() => {
        showToast('데이터가 저장되었습니다.');
      })
      .catch(() => {
        // saveToServer() 자체에서 이미 showToast를 호출하므로 별도 처리 필요 없지만,
        // 추가로 다른 로직이 필요하면 이곳에 작성 가능
      });
  }
});

// 섹션 추가 모달 오픈/클로즈 및 저장 핸들러
btnAddSection.addEventListener('click', openSectionModal);
sectionCancelBtn.addEventListener('click', closeSectionModal);
sectionOkBtn.addEventListener('click', saveNewSection);

// ==============================
// 페이지 로드 후 초기화 및 이벤트 등록
// ==============================
window.addEventListener('DOMContentLoaded', () => {
  // 연·월 드롭다운 초기화
  initYearMonthSelectors();

  // 현재 연·월 데이터 즉시 로드
  loadFromServer(
    currentYear.toString(),
    String(currentMonth).padStart(2, '0')
  );

  // 연도 변경 시 자동 로드
  selectYear.addEventListener('change', () => {
    const year  = parseInt(selectYear.value, 10);
    const month = parseInt(selectMonth.value, 10);
    currentYear  = year;
    currentMonth = month;
    loadFromServer(
      year.toString(),
      String(month).padStart(2, '0')
    );
  });

  // 월 변경 시 자동 로드
  selectMonth.addEventListener('change', () => {
    const year  = parseInt(selectYear.value, 10);
    const month = parseInt(selectMonth.value, 10);
    currentYear  = year;
    currentMonth = month;
    loadFromServer(
      year.toString(),
      String(month).padStart(2, '0')
    );
  });
});
