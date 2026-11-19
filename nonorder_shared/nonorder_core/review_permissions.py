"""Task-scoped reviewer authority, distinct from full-task delegation."""
from .storage import RuleError


def require(condition, message, status=409):
    if not condition:
        raise RuleError(message, status)


class ReviewPermissions:
    def participated(self, task_id, staff):
        assignments = self.db.rows("assignment", task_id=task_id, staff_id=staff)
        return any(not a["revoked_at"] or a["first_accepted_at"] or
                   self.db.rows("time_segment", assignment_id=a["id"]) or
                   self.db.rows("work_record", assignment_id=a["id"]) for a in assignments)

    def reviewer_eligible(self, staff, task_id=None):
        return bool(self.active_person(staff) and
                    (self.db.exempt(staff) or self.db.leader_stations(staff)) and
                    (task_id is None or not self.participated(task_id, staff)))

    def grant_valid(self, grant):
        if (grant["revoked_at"] or grant["starts_at"] > self.now or
                grant["ends_at"] and grant["ends_at"] <= self.now or not self.active_person(grant["staff_id"])):
            return False
        if grant["grant_type"] == "owner":
            if grant["qualification_source"] == "exempt":
                return self.db.exempt(grant["staff_id"])
            sources = grant["qualification_station_ids"]
            return bool(sources and set(sources) <= set(self.db.leader_stations(grant["staff_id"])))
        if grant["grant_type"] == "self_review":
            return self.reviewer_eligible(grant["staff_id"], grant["task_id"])
        return grant["grant_type"] == "delegate"

    def reviewer(self, task, valid_only=True):
        for grant in self.db.rows("manager_grant", task_id=task["id"], grant_type="self_review"):
            if not grant["revoked_at"] and (not valid_only or self.grant_valid(grant)):
                return grant
        return None

    def protected_staff(self, task):
        # Historical owner execution remains protected after handover/replacement.
        staff = set()
        for grant in self.db.rows("manager_grant", task_id=task["id"]):
            if grant["grant_type"] == "self_review":
                staff.update(grant["review_staff_ids"] or [])
            elif grant["grant_type"] == "owner" and self.participated(task["id"], grant["staff_id"]):
                staff.add(grant["staff_id"])
        return staff

    def reviewing(self, task):
        grant = self.reviewer(task)
        return bool(grant and grant["staff_id"] == self.staff and
                    (not self.admin or "nonorder.review" in self.actor["permissions"]))

    def review_right(self, task, staff, capability):
        if self.can_operate_all(task):
            return True
        if not self.staff or staff == self.staff or (self.admin and "nonorder.review" not in self.actor["permissions"]):
            return False
        if staff in self.protected_staff(task):
            grant = self.reviewer(task)
            return bool(grant and grant["staff_id"] == self.staff and staff in (grant["review_staff_ids"] or []) and capability in grant["permissions"])
        return self.right(task, capability)

    def active_exemption(self, staff):
        return self.db.exempt(staff) and self.active_person(staff)

    def reviewer_required_staff(self, task):
        return {staff for staff in self.protected_staff(task) if not self.active_exemption(staff)}

    def reviewer_candidates(self, task=None):
        eligible = self.db.exemption_ids()
        eligible.update(str(r["leader_staff_id"]) for r in self.db.external("""SELECT c.leader_staff_id
            FROM mo_station_staff_config_yx c JOIN mo_workstation_yx w ON w.id=c.station_id
            WHERE w.is_active=1 AND c.leader_staff_id IS NOT NULL"""))
        people = self.db.active_people(eligible)
        excluded = set()
        if task:
            worked = {r["assignment_id"] for name in ("time_segment", "work_record")
                      for r in self.db.rows(name, task_id=task["id"])}
            excluded = {a["staff_id"] for a in self.db.rows("assignment", task_id=task["id"])
                        if not a["revoked_at"] or a["first_accepted_at"] or a["id"] in worked}
        return [{"id": identifier, "name": p["name"]} for identifier, p in people.items() if identifier not in excluded]

    def set_reviewer(self, task, body):
        if not (self.admin and "nonorder.transfer" in self.actor["permissions"]):
            self.owner(task)
        self.replace_reviewer(task, body.get("reviewer_staff_id"), words_reason=body.get("reason"))
        return task["id"]

    def replace_reviewer(self, task, staff, words_reason):
        require(isinstance(words_reason, str) and words_reason.strip() and len(words_reason) <= 5000, "请填写核对人调整原因", 400)
        staff = str(staff or "")
        protected = self.protected_staff(task)
        require(protected, "当前没有需另选核对人的本人执行事项", 400)
        require(staff not in protected and self.reviewer_eligible(staff, task["id"]), "请选择未参与本任务的有效线长或豁免人员作为核对人", 403)
        person = self.db.person(staff)
        for grant in self.db.rows("manager_grant", task_id=task["id"], grant_type="self_review"):
            if not grant["revoked_at"]:
                self.db.update("manager_grant", grant["id"], revoked_at=self.now)
        self.db.insert("manager_grant", task_id=task["id"], staff_id=staff, staff_name=person["name"],
            grant_type="self_review", permissions=["review", "time_review"], qualification_station_ids=[],
            review_staff_ids=sorted(protected), starts_at=self.now, operator_staff_id=self.staff,
            operator_account_id=self.actor.get("account_id"), reason=words_reason.strip())

    def ensure_reviewer(self, task):
        protected = self.reviewer_required_staff(task)
        if protected:
            grant = self.reviewer(task)
            require(grant and protected <= set(grant["review_staff_ids"] or []), "请先指定有效的本人执行核对人")

    def division_review_right(self, task, division):
        if self.can_operate_all(task):
            return True
        members = self.db.rows("assignment", division_id=division["id"])
        participants = [a for a in members if not a["revoked_at"] or a["first_accepted_at"] or
                        self.db.rows("work_record", assignment_id=a["id"]) or self.db.rows("time_segment", assignment_id=a["id"])]
        if any(a["staff_id"] == self.staff for a in participants):
            return False
        protected = self.protected_staff(task) & {a["staff_id"] for a in participants}
        if protected:
            return all(self.review_right(task, staff, "review") for staff in protected)
        return bool(self.right(task, "review") and (not self.admin or "nonorder.review" in self.actor["permissions"]))
