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
    optOffset,
    optLimit,
    optRecords
  ) {
    const offset = optOffset || 0
    const limit = optLimit || 100
    let allRecords = optRecords || []
    const params = {
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

  const str2array = function (str) {
    const array = []
    const il = str.length
    for (let i = 0; i < il; i++) {
      array.push(str.charCodeAt(i))
    }
    return array
  }

  // 経費データCSV作成
  async function createExpensesCsv (outputRecordIds) {
    const csv = []
    const query =
      'check_approved in ("済") and ' +
      'acquisition_date = LAST_MONTH() and ' +
      'check_output_CSV not in ("済") ' +
      'order by レコード番号 asc'
    console.log(query)
    const records = await fetchRecords(query, [], kintone.app.getId())
    records.forEach(record => {
      const row = []
      for (const key in record) {
        const collumn = record[key].value
        // console.log(JSON.stringify(collumn))
        row.push(JSON.stringify(collumn))
      }
      outputRecordIds.push(record['$id'].value)
      csv.push(row)
    })
    const csvbuf = csv
      .map(function (e) {
        return e.join(',')
      })
      .join('\r\n')

    const array = str2array(csvbuf)
    const sjisArray = Encoding.convert(array, 'SJIS', 'UNICODE')
    const uint8Array = new Uint8Array(sjisArray)
    const blob = new Blob([uint8Array], { type: 'text/csv' })
    return blob
  }

  function updateCheckOutputCsv (outputRecordIds) {
    const allPromise = []
    outputRecordIds.forEach(function (id) {
      const body = {
        app: kintone.app.getId(),
        id: id,
        record: {
          check_output_CSV: {
            value: ['済']
          }
        }
      }

      const promise = new kintone.Promise(function (resolve, reject) {
        kintone.api(
          kintone.api.url('/k/v1/record', true),
          'PUT',
          body,
          function (resp) {
            // success
            console.log(resp)
            resolve()
          },
          function (error) {
            // error
            console.log(error)
            reject()
          }
        )
      })
      allPromise.push(promise)
    })
    return kintone.Promise.all(allPromise)
  }

  async function downloadCsv () {
    const outputRecordIds = []
    const blob = await createExpensesCsv(outputRecordIds)
    console.log(outputRecordIds)

    const link = document.createElement('a')
    link.href = (window.URL || window.webkitURL).createObjectURL(blob)
    link.download = 'download.csv'
    link.click()

    updateCheckOutputCsv(outputRecordIds).then(function () {
      location.reload()
    })
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
