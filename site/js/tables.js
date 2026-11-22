function renderDataTable(headers, rows) {
  const wrapper = document.createElement("div");
  wrapper.className = "data-table-wrap";
  const table = document.createElement("table");
  table.className = "data-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((label) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  rows.forEach((values) => {
    const row = document.createElement("tr");
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}
