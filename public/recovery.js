let table = $('#recordsTable').DataTable({
    ajax: {
        url: "/api/recovery/getRecords",
        dataSrc: ""
    },
    columns: [
        { data: 'PART_NUMBER' },
        { data: 'DESCRIPTION' },
        { data: 'MODEL' },
        { data: 'RECOVER' },
        { data: 'SITE' },
        {
            data: null,
            render: function (data, type, row) {
                let button = '<button class="updateButton">';
                button += data.RECOVER == 1 ? 'No Recover' : 'Recover';
                button += '</button>';
                return button;
            }
        }
    ]
});

$('#recordsTable tbody').on('click', 'button.updateButton', function () {
    let data = table.row($(this).parents('tr')).data();
    updateRecord(data.PART_NUMBER, data.MODEL, data.RECOVER);
});

$('#searchButton').on('click', function() {
    let partNumber = $('#searchPartNumber').val().toLowerCase();
    let model = $('#searchModel').val().toLowerCase();
    let description = $('#searchDescription').val().toLowerCase();
    let site = $('#searchSite').val().toLowerCase();
    let recover = $('#searchRecover').val();

    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            return data[0].toLowerCase().includes(partNumber) 
                && data[1].toLowerCase().includes(description)
                && data[2].toLowerCase().includes(model)
                && data[3] === (recover || data[3])
                && data[4].toLowerCase().includes(site);
        }
    );
    
    table.draw();
    $.fn.dataTable.ext.search.pop();
});

async function updateRecord(part_number, model, recover) {
    let url = '/api/recovery/updateRecord';
    let body = {
        part_number: part_number,
        model: model,
        recover: recover == 1 ? 0 : 1  // toggle recover status
    };

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    table.ajax.reload(null, false);  // refresh the table
}
