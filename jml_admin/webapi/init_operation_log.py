"""Explicit, idempotent setup and historical backfill for operation logs."""
from pathlib import Path


BACKFILL_STATEMENTS = (
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       worker_names,mo_code,sort_seq,route_id,seq,process_name,station_id,
       station_name,photo_urls,source_type,source_id,details)
    SELECT CONCAT('execution:start:',e.id),'start','开工',e.start_time,
           e.operator_id,COALESCE(e.operator_name,''),COALESCE(w.worker_names,''),
           e.mo_code,e.sort_seq,e.route_id,e.seq,COALESCE(e.process_name,''),
           e.station_id,COALESCE(e.station_name,''),
           IF(NULLIF(e.start_photo_url,'') IS NULL,NULL,JSON_ARRAY(e.start_photo_url)),
           'execution',e.id,JSON_OBJECT('historical',TRUE)
    FROM mo_execution_yx e
    LEFT JOIN (
      SELECT execution_id,GROUP_CONCAT(user_name_snapshot ORDER BY id SEPARATOR '、') worker_names
      FROM mo_execution_worker_yx GROUP BY execution_id
    ) w ON w.execution_id=e.id
    WHERE e.start_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       mo_code,sort_seq,route_id,seq,process_name,station_id,station_name,
       qty,qty_a,qty_a1,qty_a2,qty_c,reason,photo_urls,
       source_type,source_id,details)
    SELECT CONCAT('completion:',c.id),'complete',
           IF(c.is_final=1,'完工','分批完工'),c.complete_time,
           c.operator_id,COALESCE(c.operator_name,''),e.mo_code,e.sort_seq,
           e.route_id,e.seq,COALESCE(e.process_name,''),e.station_id,
           COALESCE(e.station_name,''),c.qty_done,c.qty_a,c.qty_a1,c.qty_a2,c.qty_c,
           c.reason,IF(NULLIF(c.photo_url,'') IS NULL,NULL,JSON_ARRAY(c.photo_url)),
           'completion',c.id,JSON_OBJECT('historical',TRUE,'is_final',c.is_final)
    FROM mo_execution_completion_yx c
    JOIN mo_execution_yx e ON e.id=c.execution_id
    WHERE c.complete_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_name,mo_code,sort_seq,
       route_id,seq,process_name,station_id,station_name,qty,qty_a,qty_a1,qty_a2,
       reason,photo_urls,source_type,source_id,details)
    SELECT CONCAT('handover:receive:',h.id),
           IF(h.from_seq=0,'receive_first','receive'),
           IF(h.from_seq=0,'首工序领料接收','工序接收'),h.confirm_time,
           COALESCE(h.operator_in,''),h.mo_code,h.sort_seq,h.route_id,h.to_seq,
           COALESCE(p.process_name,''),h.to_station_id,COALESCE(w.station_name,''),
           h.qty_in,h.qty_in_a,h.qty_in_a1,h.qty_in_a2,h.receipt_reason,
           IF(NULLIF(h.receive_photo_url,'') IS NULL,NULL,JSON_ARRAY(h.receive_photo_url)),
           'handover',h.id,JSON_OBJECT('historical',TRUE)
    FROM mo_handover_yx h
    LEFT JOIN mo_route_step_yx step ON step.route_id=h.route_id AND step.seq=h.to_seq
    LEFT JOIN mo_process_yx p ON p.id=step.process_id
    LEFT JOIN mo_workstation_yx w ON w.id=h.to_station_id
    WHERE h.status='confirmed' AND h.confirm_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       worker_names,mo_code,sort_seq,route_id,seq,process_name,station_id,
       station_name,qty,qty_a,qty_a1,qty_a2,reason,photo_urls,
       source_type,source_id,details)
    SELECT CONCAT('receive_work:start:',r.id),'receive_work_start','追加接收开工',
           r.start_time,r.operator_id,COALESCE(r.operator_name,''),
           COALESCE(ws.worker_names,''),r.mo_code,r.sort_seq,r.route_id,r.seq,
           COALESCE(r.process_name,''),e.station_id,COALESCE(e.station_name,''),
           r.qty_input,r.qty_input_a,r.qty_input_a1,r.qty_input_a2,r.reason,
           IF(NULLIF(r.photo_url,'') IS NULL,NULL,JSON_ARRAY(r.photo_url)),
           'receive_work',r.id,JSON_OBJECT('historical',TRUE)
    FROM mo_receive_work_yx r
    LEFT JOIN mo_execution_yx e ON e.id=r.execution_id
    LEFT JOIN (
      SELECT receive_id,GROUP_CONCAT(user_name_snapshot ORDER BY id SEPARATOR '、') worker_names
      FROM mo_receive_worker_yx GROUP BY receive_id
    ) ws ON ws.receive_id=r.id
    WHERE r.start_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       worker_names,mo_code,sort_seq,route_id,seq,process_name,station_id,
       station_name,qty,reason,photo_urls,source_type,source_id,details)
    SELECT CONCAT('rework:start:',r.id),'rework_start','发起返工',r.start_time,
           r.operator_id,COALESCE(r.operator_name,''),COALESCE(ws.worker_names,''),
           r.mo_code,r.sort_seq,r.route_id,r.seq,COALESCE(r.process_name,''),
           e.station_id,COALESCE(e.station_name,''),r.qty_input,r.reason,
           IF(NULLIF(r.photo_url,'') IS NULL,NULL,JSON_ARRAY(r.photo_url)),
           'rework',r.id,JSON_OBJECT('historical',TRUE)
    FROM mo_rework_yx r
    LEFT JOIN mo_execution_yx e ON e.id=r.source_execution_id
    LEFT JOIN (
      SELECT rework_id,GROUP_CONCAT(user_name_snapshot ORDER BY id SEPARATOR '、') worker_names
      FROM mo_rework_worker_yx GROUP BY rework_id
    ) ws ON ws.rework_id=r.id
    WHERE r.start_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       mo_code,sort_seq,route_id,seq,process_name,station_id,station_name,
       qty,qty_a,qty_a1,qty_a2,qty_c,reason,photo_urls,
       source_type,source_id,details)
    SELECT CONCAT('rework_completion:',c.id),'rework_complete','返工完工',
           c.complete_time,c.operator_id,COALESCE(c.operator_name,''),
           r.mo_code,r.sort_seq,r.route_id,r.seq,COALESCE(r.process_name,''),
           e.station_id,COALESCE(e.station_name,''),c.qty_done,c.qty_a,c.qty_a1,
           c.qty_a2,c.qty_c,c.remark,
           IF(NULLIF(c.photo_url,'') IS NULL,NULL,JSON_ARRAY(c.photo_url)),
           'rework_completion',c.id,
           JSON_OBJECT('historical',TRUE,'rework_id',r.id,'is_final',c.is_final)
    FROM mo_rework_completion_yx c
    JOIN mo_rework_yx r ON r.id=c.rework_id
    LEFT JOIN mo_execution_yx e ON e.id=r.source_execution_id
    WHERE c.complete_time IS NOT NULL
    """,
    """
    INSERT IGNORE INTO mo_operation_log_yx
      (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
       mo_code,sort_seq,route_id,seq,process_name,station_id,station_name,
       qty,reason,source_type,source_id,details)
    SELECT CONCAT('makeup:',m.id),'receive_more','追加接收',m.create_time,
           m.operator_id,COALESCE(m.operator_name,''),m.mo_code,m.sort_seq,
           e.route_id,m.seq,COALESCE(e.process_name,''),e.station_id,
           COALESCE(e.station_name,''),m.qty_add,m.reason,'makeup',m.id,
           JSON_OBJECT('historical',TRUE,'qty_before',m.qty_before,
                       'qty_after',m.qty_after,'reference_qty',m.plan_qty)
    FROM mo_makeup_record_yx m
    LEFT JOIN mo_execution_yx e ON e.id=m.execution_id
    WHERE m.create_time IS NOT NULL
    """,
)


def initialize(conn):
    cur = conn.cursor()
    try:
        schema = Path(__file__).with_name("operation_log.sql").read_text(
            encoding="utf-8"
        )
        for statement in schema.split(";"):
            if statement.strip():
                cur.execute(statement)
        for statement in BACKFILL_STATEMENTS:
            cur.execute(statement)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


if __name__ == "__main__":
    from app import db

    connection = db()
    try:
        initialize(connection)
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS total FROM mo_operation_log_yx")
        total = cursor.fetchone()["total"]
        cursor.close()
        print(f"工序操作日志表初始化完成，当前共 {total} 条记录。")
    finally:
        connection.close()
