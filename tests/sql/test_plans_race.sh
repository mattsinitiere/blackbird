# Concurrent plan creation from many "tabs": the limit must hold.
set -euo pipefail
read -r -a PSQL <<<"$PSQL_CMD"
U=e0000000-0000-0000-0000-00000000000e
"${PSQL[@]}" -c "insert into auth.users values ('$U','race@test')"
DEF='{"sessions":[{"items":[{}]}]}'
tmp=$(mktemp -d)
# ten different requests at once
for i in $(seq 1 10); do
  ( "${PSQL[@]}" -c "set role service_role; select create_training_plan('$U','race-key-$i','custom','$DEF'::jsonb,null)" >"$tmp/$i.out" 2>&1 && echo ok >"$tmp/$i.st" || echo err >"$tmp/$i.st" ) &
done
wait
n=$("${PSQL[@]}" -At -c "select count(*) from training_plans where auth_id='$U'")
oks=$(grep -l ok "$tmp"/*.st | wc -l)
limits=$(grep -l plan_limit "$tmp"/*.out | wc -l)
echo "plans=$n ok=$oks limit_errors=$limits"
[ "$n" = "3" ] && [ "$oks" = "3" ] && [ "$limits" = "7" ]
# the same request key sent five times at once makes one plan
V=f0000000-0000-0000-0000-00000000000f
"${PSQL[@]}" -c "insert into auth.users values ('$V','retry@test')"
for i in $(seq 1 5); do
  ( "${PSQL[@]}" -c "set role service_role; select create_training_plan('$V','same-key-123','ai','$DEF'::jsonb,null)" >/dev/null 2>&1 ) &
done
wait
m=$("${PSQL[@]}" -At -c "select count(*) from training_plans where auth_id='$V'")
echo "same-key plans=$m"
[ "$m" = "1" ]
rm -rf "$tmp"
