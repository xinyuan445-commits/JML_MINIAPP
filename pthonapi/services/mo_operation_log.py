"""Immutable production-operation events written inside the business transaction."""
import json


def write_operation_log(cur, **event):
    worker_details = event.get("worker_details") or []
    worker_names = event.get("worker_names") or "、".join(
        item.get("name", "") if isinstance(item, dict) else str(item)
        for item in worker_details
        if item
    )
    photo_urls = event.get("photo_urls") or []
    cur.execute(
        """
        INSERT INTO mo_operation_log_yx
          (event_key,event_type,event_name,occurred_at,operator_id,operator_name,
           worker_names,worker_details,mo_code,sort_seq,route_id,seq,
           process_name,station_id,station_name,qty,qty_a,qty_a1,qty_a2,qty_c,
           reason,photo_urls,source_type,source_id,details)
        VALUES
          (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
           %s,%s,%s,%s,%s)
        """,
        (
            event.get("event_key"),
            event["event_type"],
            event["event_name"],
            event["occurred_at"],
            event.get("operator_id") or None,
            event.get("operator_name") or "",
            worker_names,
            json.dumps(worker_details, ensure_ascii=False) if worker_details else None,
            event["mo_code"],
            event["sort_seq"],
            event.get("route_id"),
            event.get("seq"),
            event.get("process_name") or "",
            event.get("station_id"),
            event.get("station_name") or "",
            event.get("qty"),
            event.get("qty_a"),
            event.get("qty_a1"),
            event.get("qty_a2"),
            event.get("qty_c"),
            event.get("reason") or None,
            json.dumps(photo_urls, ensure_ascii=False) if photo_urls else None,
            event.get("source_type") or None,
            event.get("source_id"),
            json.dumps(event.get("details"), ensure_ascii=False)
            if event.get("details")
            else None,
        ),
    )


def worker_snapshots(worker_map, worker_ids, temp_worker_count=0):
    workers = [
        {"id": worker_id, "name": worker_map[worker_id]["user_name"]}
        for worker_id in worker_ids
        if worker_id in worker_map
    ]
    workers.extend(
        {"id": None, "name": f"临时工{index}"}
        for index in range(1, temp_worker_count + 1)
    )
    return workers
