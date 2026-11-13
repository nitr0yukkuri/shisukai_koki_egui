/**
 * 履歴にはESセットの識別情報だけを残し、コピー済みの本文を除去する。
 * ES本文は元のes_itemsにのみ保存する(削除時のデータ最小化)。
 */
export const migration0003EsSnapshotNameOnly = {
  version: 3,
  name: "es-snapshot-name-only",
  sql: `
UPDATE sessions
   SET es_snapshot_json = CASE
     WHEN json_valid(es_snapshot_json) THEN
       CASE
         WHEN json_type(es_snapshot_json) = 'object' THEN
           json_object(
             'id', json_extract(es_snapshot_json, '$.id'),
             'name', json_extract(es_snapshot_json, '$.name')
           )
         ELSE 'null'
       END
     ELSE 'null'
   END;
`,
} as const;
