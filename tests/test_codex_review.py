import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(os.environ.get('REVIEW_SCRIPTS', Path(__file__).resolve().parents[1] / 'dot_bin'))


class ReviewTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.config_home = Path(directory.name)
        self.ci_config = self.config_home / 'codex-pr-review/config.json'
        self.ci_config.parent.mkdir()
        self.ci_config.write_text(json.dumps({'repositories': [], 'skip_pending_checks': ['ci-ok']}))

    def run_script(self, name, code, env=None):
        path = ROOT / ('executable_' + name)
        if not path.exists():
            path = ROOT / name
        source = path.read_text().rsplit('\nmain "$@"', 1)[0]
        variables = os.environ.copy()
        variables['XDG_CONFIG_HOME'] = str(self.config_home)
        variables.update(env or {})
        return subprocess.run(['bash', '-c', source + '\n' + code], env=variables, text=True, capture_output=True, timeout=10)

    def test_ci_states(self):
        cases = [
            ('[]', 0, 'pass'),
            ('[{"name":"ci-ok","bucket":"pending"}]', 8, 'pass'),
            ('[{"name":"rspec","bucket":"pending"}]', 8, 'pending'),
            ('[{"name":"rspec","bucket":"fail"}]', 1, 'fail'),
            ('[{"name":"ci-ok","bucket":"fail"}]', 1, 'fail'),
            ('[{"name":"ci-ok","bucket":"pending"},{"name":"rspec","bucket":"pending"}]', 8, 'pending'),
            ('[{"name":"ci-ok","bucket":"pending"},{"name":"rspec","bucket":"fail"}]', 1, 'fail'),
            ('[{"name":"rspec","bucket":"cancel"}]', 0, 'fail'),
            ('', 1, 'unknown'), (' ', 0, 'unknown'),
            ('{}', 0, 'unknown'), ('invalid', 0, 'unknown'),
            ('[{"name":"x","bucket":"unexpected"}]', 0, 'unknown'),
        ]
        for name in ['codex-code-pr-review', 'codex-dep-pr-review']:
            for checks, status, expected in cases:
                with self.subTest(name=name, checks=checks):
                    result = self.run_script(name, '''
repo=x number=1
gh() { printf '%s' "$CHECKS"; return "$GH_STATUS"; }
ci_state
''', {'CHECKS': checks, 'GH_STATUS': str(status)})
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout.strip(), expected)

    def test_pending_checks_are_configured_by_exact_name(self):
        cases = [
            ('["other-check"]', 'ci-ok', 'pending', 'pending'),
            ('["other-check"]', 'other-check', 'pending', 'pass'),
            ('["other-check"]', 'other-check / test', 'pending', 'pending'),
            ('["other-check"]', 'other-check', 'fail', 'fail'),
            ('["other-check"]', 'other-check', 'cancel', 'fail'),
            ('["ci-ok", "other-check"]', 'other-check', 'pending', 'pass'),
            ('[]', 'ci-ok', 'pending', 'pending'),
            (None, 'ci-ok', 'pending', 'pending'),
            ('invalid', 'ci-ok', 'pending', 'unknown'),
            ('', 'ci-ok', 'pending', 'unknown'),
            ('{}', 'ci-ok', 'pending', 'unknown'),
            ('[1]', 'ci-ok', 'pending', 'unknown'),
            ('[] []', 'ci-ok', 'pending', 'unknown'),
        ]
        for name in ['codex-code-pr-review', 'codex-dep-pr-review']:
            for config, check, bucket, expected in cases:
                with self.subTest(name=name, config=config, bucket=bucket):
                    if config is None:
                        self.ci_config.unlink(missing_ok=True)
                    else:
                        if config in ['invalid', '', '[] []']:
                            self.ci_config.write_text(config)
                        else:
                            self.ci_config.write_text(json.dumps({'repositories': [], 'skip_pending_checks': json.loads(config)}))
                    result = self.run_script(name, '''
repo=x number=1
gh() { printf '%s' "$CHECKS"; return 8; }
ci_state
''', {'CHECKS': json.dumps([{'name': check, 'bucket': bucket}])})
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout.strip(), expected)

    def test_watch_uses_unified_repository_list(self):
        self.ci_config.write_text(json.dumps({'repositories': ['x/alpha', 'x/beta'], 'skip_pending_checks': ['ci-ok']}))
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_script('codex-pr-review-watch', '''
mkdir -p "$STATE_DIR"
printf 'x/alpha#9\\nx/removed#8\\n' >"$TRACKED"
gh() { printf 'x/alpha#1\\nx/beta#2\\nx/other#3\\n'; }
discover
cat "$TRACKED"
''', {'XDG_STATE_HOME': directory, 'DEV_FLOW_REPOS': 'x/other'})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), ['x/alpha#1', 'x/alpha#9', 'x/beta#2'])

    def test_invalid_repositories_do_not_clear_tracking(self):
        for repositories in [None, 'x/alpha', ['invalid'], [1]]:
            self.ci_config.write_text(json.dumps({'repositories': repositories, 'skip_pending_checks': []}))
            with tempfile.TemporaryDirectory() as directory:
                result = self.run_script('codex-pr-review-watch', '''
mkdir -p "$STATE_DIR"
echo 'x/alpha#9' >"$TRACKED"
discover
''', {'XDG_STATE_HOME': directory})
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual((Path(directory) / 'codex-pr-review/tracked').read_text(), 'x/alpha#9\n')

    def test_config_modifier_preserves_user_settings(self):
        modifier = ROOT.parent / 'dot_config/codex-pr-review/modify_config.json'
        existing = {'repositories': ['private/repo'], 'skip_pending_checks': [], 'extra': True}
        for before, expected in [
            ('', {'repositories': [], 'skip_pending_checks': ['ci-ok']}),
            (json.dumps(existing), existing),
            ('{"repositories":["private/repo"]}', {'repositories': ['private/repo'], 'skip_pending_checks': ['ci-ok']}),
        ]:
            result = subprocess.run(['python3', str(modifier)], input=before, text=True, capture_output=True, check=True)
            self.assertEqual(json.loads(result.stdout), expected)
        result = subprocess.run(['python3', str(modifier)], input='invalid', text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')

    def test_old_ci_failure_is_retried(self):
        for body, expected in [
            ('<!-- codex-deps:v1 head=abc verdict=needs_human -->\n- ❌ CI：通っていない', 1),
            ('<!-- codex-deps:v1 head=abc verdict=needs_human -->\n- ❌ major：2 -> 3', 0),
            ('<!-- codex-deps:v1 head=abc verdict=ok -->', 0),
        ]:
            reviews = [[{'user': {'login': 'me'}, 'body': body}]]
            result = self.run_script('codex-dep-pr-review', '''
repo=x number=1 me=me head=abc
gh() { case "$*" in *issues*) echo '[[]]' ;; *) printf '%s' "$REVIEWS" ;; esac; }
already_checked
''', {'REVIEWS': json.dumps(reviews)})
            self.assertEqual(result.returncode, expected, result.stderr)

    def test_failed_dependency_ci_waits_without_marking_checked(self):
        for state in ['fail', 'pending', 'unknown']:
            result = self.run_script('codex-dep-pr-review', '''
parse_args() { :; }
require_environment() { :; }
load_pull_request() { repo=x number=1 head=abc; }
ci_state() { echo "$CI_STATE"; }
already_checked() { echo UNEXPECTED; exit 99; }
main
''', {'CI_STATE': state})
            self.assertEqual(result.returncode, 3, result.stderr)
            self.assertNotIn('UNEXPECTED', result.stdout)

    def test_unknown_ci_cannot_approve(self):
        for state in ['unknown', 'fail']:
            result = self.run_script('codex-code-pr-review', '''
author=other me=me repo=x number=1 head=abc
ci_state() { echo "$CI_STATE"; }
gh() { return 1; }
post_review() { echo UNEXPECTED; exit 99; }
judge_ci_failure() { echo UNEXPECTED; exit 99; }
finish_when_ci_done /nonexistent/review.json
''', {'CI_STATE': state})
            self.assertEqual(result.returncode, 3, result.stderr)
            self.assertNotIn('UNEXPECTED', result.stdout)
            self.assertEqual(result.stderr, '')

    def test_approved_review_processes_author_reply(self):
        for replied, expected in [('true', 0), ('false', 3)]:
            result = self.run_script('codex-code-pr-review', '''
parse_args() { :; }
require_environment() { :; }
load_pull_request() { repo=x number=1 head=abc pending=/nonexistent/review.json; }
load_last_review() { last_head=abc last_state=APPROVED last_round=1; open='[{"severity":"ask"}]'; }
author_replied() { "$REPLIED"; }
checkout() { echo REVIEW_STARTED; exit 0; }
main
''', {'REPLIED': replied})
            self.assertEqual(result.returncode, expected, result.stderr)
            self.assertEqual('REVIEW_STARTED' in result.stdout, replied == 'true')

    def test_model_launch_disables_project_instructions_and_reports_usage_once(self):
        with tempfile.TemporaryDirectory() as directory:
            for name in ['codex-code-pr-review', 'codex-dep-pr-review']:
                result = self.run_script(name, '''
run="$CASE_DIR" tree="$CASE_DIR"
codex() {
  printf '%s\\n' "$@" >"$run/argv"
  while [ "$1" != -o ]; do shift; done
  printf '{"findings":[]}' >"$2"
}
run_codex reviewer test low unused '.findings | type == "array"' prompt
run_codex advisor test low unused '.findings | type == "array"' prompt
''', {'CASE_DIR': directory})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.count('codex-used: true'), 1)
                self.assertIn('project_doc_max_bytes=0', (Path(directory) / 'argv').read_text())

    def test_watch_counts_ai_work_even_when_waiting_for_ci(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_script('codex-pr-review-watch', '''
in_working_hours() { return 0; }
take_lock() { return 0; }
discover() { printf 'x#%s\\n' {1..12} >"$TRACKED"; }
gh() { echo '{"state":"OPEN","title":"feature","headRefName":"feature","labels":[],"isDraft":false}'; }
codex-code-pr-review() { echo CALL >>"$CASE_DIR/calls"; echo 'codex-used: true'; return 3; }
check_dependency_updates() { :; }
weekly_report() { :; }
main
''', {'CASE_DIR': directory, 'XDG_STATE_HOME': directory})
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len((Path(directory) / 'calls').read_text().splitlines()), 10)

    def test_watch_lock_is_held_until_owner_exits(self):
        with tempfile.TemporaryDirectory() as directory:
            script = ROOT / 'executable_codex-pr-review-watch'
            if not script.exists():
                script = ROOT / 'codex-pr-review-watch'
            source = script.read_text().rsplit('\nmain "$@"', 1)[0]
            env = os.environ.copy()
            env['XDG_STATE_HOME'] = directory
            owner = subprocess.Popen(['bash', '-c', source + '\nmkdir -p "$STATE_DIR"; take_lock || exit; echo LOCKED; read -r value'], env=env, text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
            try:
                self.assertEqual(owner.stdout.readline().strip(), 'LOCKED')
                lock = str(Path(directory) / 'codex-pr-review/watch.lockfile')
                self.assertEqual(subprocess.run(['/usr/bin/lockf', '-ks', '-t', '0', lock, 'true']).returncode, 75)
                owner.communicate('done\n', timeout=3)
                self.assertEqual(subprocess.run(['/usr/bin/lockf', '-ks', '-t', '0', lock, 'true']).returncode, 0)
            finally:
                if owner.poll() is None:
                    owner.kill()
                    owner.wait()


if __name__ == '__main__':
    unittest.main()
