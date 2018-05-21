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

  function createCsvRow (record) {
    const row = []
    // 1 処理区分
    row.push('1')
    // 2 データID
    row.push('')
    // 3 伝票日付
    row.push(record['acquisition_date'].value)
    // 4 伝票番号
    row.push('')
    // 5 入力日付
    // --------------------------借方
    row.push('')
    // 6 借方・科目
    const itemOfExpenseCode = record['item_of_expense_code'].value
    row.push(itemOfExpenseCode.slice(-4))
    // 7 補助コード
    if (itemOfExpenseCode.indexOf('外注費') !== -1) {
      row.push('13')
    } else {
      row.push('')
    }
    // 8 部門コード
    row.push('')
    // 9 取引先コード
    row.push('')
    // 10 取引先名
    row.push('')
    // 11 税種別
    const genkaCodes = ['外注費', '広告宣伝費', 'ｺﾐｯｼｮﾝ料', 'SaaS代', '仕入外注費']
    let genka = '60'
    if (genkaCodes.find(code => itemOfExpenseCode.indexOf(code) >= 0)) {
      genka = '50' // 原価の場合
    }
    row.push(genka)
    // 12 事業区分
    row.push('1')
    // 13 税率
    row.push('8') // 税率8%
    // 14 内外別記
    row.push('1') // 内税表記は1
    // 15 金額
    const price = record['price'].value
    row.push(price)
    // 16 税額
    row.push('')
    // 17 摘要
    const summary = record['item'].value
    row.push(summary)
    // --------------------------貸方
    // 18 貸方・科目（小口現金の場合は1118）
    const name = record['name'].value
    if (name === '小口現金') {
      row.push('1118')
    } else {
      row.push('2114')
    }
    // 19 補助コード
    const user = record['user_json'].value
      .split(',')
      .find(userId => userId.indexOf(name) > 0)
    if (user) {
      row.push(user.split(':')[1])
    } else {
      row.push('')
    }
    // 20 部門コード
    row.push('')
    // 21 取引先コード
    row.push('')
    // 22 取引先名
    row.push('')
    // 23 税種別
    row.push(genka)
    // 24 事業区分
    row.push('1')
    // 25 税率
    row.push('8') // 税率8%
    // 26 内外別記
    row.push('1') // 内税表記は1
    // 27 金額
    row.push(price)
    // 28 税額
    row.push('')
    // 29 摘要
    row.push(summary)

    return row
  }

  // 経費データCSV作成
  async function createExpensesCsv (outputRecordIds) {
    const csv = []
    const query =
      'check_approved in ("済") and ' +
      'acquisition_date = LAST_MONTH() and ' +
      'check_output_CSV not in ("済") ' +
      'order by acquisition_date asc'
    console.log(query)
    const records = await fetchRecords(query, [], kintone.app.getId())
    records.forEach(record => {
      const row = createCsvRow(record)
      console.log(row)
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
    const today = new Date()
    let month = today.getMonth() + 1
    month = ('00' + month).slice(-2)
    let date = today.getDate()
    date = ('00' + date).slice(-2)
    link.download = '未払計上仕訳_' + today.getFullYear() + month + date + '.csv'
    link.click()

    // updateCheckOutputCsv(outputRecordIds).then(function () {
    //   location.reload()
    // })
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
