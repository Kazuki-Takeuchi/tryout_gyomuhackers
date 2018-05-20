;(function ($) {
  'use strict'
  const createDialog = function () {
    const $dialog = $('<div>', {
      id: 'dialog_output_csv',
      style: 'display:none;'
    })
    $dialog.append(
      $('<p>', {
        text: 'CSVを出力します'
      })
    )
    return $dialog
  }

  const createOutputCsvButton = function () {
    const $outputCsvButton = $('<button>', {
      id: 'button_output_csv',
      text: 'CSV出力'
    }).click(function () {
      $('#dialog_output_csv').dialog({
        modal: true, // モーダル表示
        title: 'CSV出力', // タイトル
        buttons: {
          // ボタン
          OK: function () {
            $(this).dialog('close')
            if (canDownloadCsv()) {
              downloadCsv()
            }
          },
          Cancel: function () {
            $(this).dialog('close')
          }
        }
      })
    })
    return $outputCsvButton
  }

  const canDownloadCsv = function () {
    if ((window.URL || window.webkitURL).createObjectURL == null) {
      // サポートされていないブラウザ
      return false
    }
    return true
  }

  function fetchRecords (
    searchQuery,
    fields,
    appId,
    opt_offset,
    opt_limit,
    opt_records
  ) {
    var offset = opt_offset || 0
    var limit = opt_limit || 100
    var allRecords = opt_records || []
    var params = {
      app: appId,
      query: searchQuery + ' limit ' + limit + ' offset ' + offset,
      fields: fields
    }
    return new kintone.Promise(function (resolve, reject) {
      kintone
        .api('/k/v1/records', 'GET', params)
        .then(function (resp) {
          allRecords = allRecords.concat(resp.records)
          if (resp.records.length === limit) {
            return fetchRecords(
              searchQuery,
              fields,
              appId,
              offset + limit,
              limit,
              allRecords
            )
          }
          console.log(allRecords)
          resolve(allRecords)
        })
        .catch(function (error) {
          console.log(error)
          reject(error)
        })
    })
  }

  // 経費データCSV作成
  async function createExpensesCsv (output_record_ids) {
    let csv = []
    var now = new Date()
    let query =
      'check_approved in ("済") and ' +
      'acquisition_date = LAST_MONTH() and ' +
      'check_output_CSV not in ("済") ' +
      'order by レコード番号 asc'
    console.log(query)
    let records = await fetchRecords(query, [], kintone.app.getId())
    records.forEach(record => {
      let row = []
      for (let key in record) {
        let collumn = record[key].value
        // console.log(JSON.stringify(collumn))
        row.push(JSON.stringify(collumn))
      }
      output_record_ids.push(record['$id'].value)
      csv.push(row)
    })
    let csvbuf = csv
      .map(function (e) {
        return e.join(',')
      })
      .join('\r\n')
    let bom = new Uint8Array([0xef, 0xbb, 0xbf])
    let blob = new Blob([bom, csvbuf], { type: 'text/csv' })
    return blob
  }

  async function downloadCsv () {
    let output_record_ids = []
    let blob = await createExpensesCsv(output_record_ids)
    console.log(output_record_ids)

    let link = document.createElement('a')
    link.href = (window.URL || window.webkitURL).createObjectURL(blob)
    link.download = 'download.csv'
    link.click()
  }

  kintone.events.on('app.record.index.show', function (event) {
    if (event.viewId !== 5299939) {
      // 出力用一覧（当月&出力済除外）以外なら何もしない
      return
    }

    if (!$('#dialog_output_csv')[0]) {
      $(kintone.app.getHeaderSpaceElement()).append(createDialog())
    }

    if (!$('#button_output_csv')[0]) {
      $(kintone.app.getHeaderMenuSpaceElement()).append(createOutputCsvButton())
    }
  })
})(jQuery)
