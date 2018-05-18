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
      id: 'output_csv',
      text: 'CSV出力'
    }).click(function () {
      $('#dialog_output_csv').dialog({
        modal: true, // モーダル表示
        title: 'CSV出力', // タイトル
        buttons: {
          // ボタン
          OK: function () {
            $(this).dialog('close')
          },
          Cancel: function () {
            $(this).dialog('close')
          }
        }
      })
    })
    return $outputCsvButton
  }

  kintone.events.on('app.record.index.show', function (event) {
    if (event.viewId !== 5299939) {
      // 出力用一覧（当月&出力済除外）以外なら何もしない
      return
    }

    if (!$('#dialog_output_csv')[0]) {
      $(kintone.app.getHeaderSpaceElement()).append(createDialog())
    }

    if (!$('#output_csv')[0]) {
      $(kintone.app.getHeaderMenuSpaceElement()).append(createOutputCsvButton())
    }
  })
})(jQuery)
