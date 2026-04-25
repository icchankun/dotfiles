#!/usr/bin/env ruby
# frozen_string_literal: true

# PR の未解決レビューコメント（レビュースレッド）を取得し、JSON で標準出力する。
# 使い方: ruby fetch_pr_comments.rb <owner/repo> <pr_number>
#
# 依存: gh CLI（認証済み）

require "json"
require "open3"

Result = Data.define(:pr_title, :pr_url, :unresolved_thread_count, :threads)

class PrUnresolvedThreadFetcher
  QUERY = <<~GRAPHQL
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          title # PRのタイトル
          url   # PRのURL
          reviewThreads(first: 50) {
            nodes {
              id         # スレッドID（PRRT_...）。resolveReviewThread mutation に使用
              isResolved # スレッドが解決済みかどうか。REST APIでは取得不可
              comments(first: 50) {
                nodes {
                  id        # コメントID（PRRC_...）
                  author { login __typename } # login: GitHubユーザー名, __typename: "User" or "Bot"
                  body      # コメント本文（Markdown）
                  path      # レビュー対象のファイルパス
                  line      # コメントが付けられた行番号
                  createdAt # コメントの作成日時（ISO 8601）
                  url       # コメントへの直リンク
                }
              }
            }
          }
        }
      }
    }
  GRAPHQL

  def self.call(owner:, repo:, number:)
    new(owner:, repo:, number:).call
  end

  def initialize(owner:, repo:, number:)
    @owner = owner
    @repo = repo
    @number = number
  end

  def call
    Result.new(
      pr_title: pull_request["title"],
      pr_url: pull_request["url"],
      unresolved_thread_count: unresolved_threads.size,
      threads: unresolved_threads
    )
  end

  private

  attr_reader :owner, :repo, :number

  def pull_request
    @pull_request ||= fetch_pull_request
  end

  def unresolved_threads
    @unresolved_threads ||= extract_unresolved_threads(pull_request.dig("reviewThreads", "nodes"))
  end

  def fetch_pull_request
    stdout, stderr, status = Open3.capture3(
      "gh", "api", "graphql",
      "-f", "query=#{QUERY}",
      "-F", "owner=#{owner}",
      "-F", "repo=#{repo}",
      "-F", "number=#{number}"
    )
    abort "gh api error: #{stderr}" unless status.success?

    pr = JSON.parse(stdout).dig("data", "repository", "pullRequest")
    abort "PR not found: #{owner}/#{repo}##{number}" unless pr

    pr
  end

  def extract_unresolved_threads(nodes)
    nodes.filter_map do |thread|
      next if thread["isResolved"]

      {
        thread_id: thread["id"],
        is_resolved: false,
        comments: thread.dig("comments", "nodes").map { |c| build_comment(c) }
      }
    end
  end

  def build_comment(comment)
    {
      id: comment["id"],
      author: comment.dig("author", "login"),
      author_type: comment.dig("author", "__typename"),
      body: comment["body"],
      path: comment["path"],
      line: comment["line"],
      created_at: comment["createdAt"],
      url: comment["url"]
    }
  end
end

if ARGV.size != 2
  abort "Usage: ruby #{$PROGRAM_NAME} <owner/repo> <pr_number>"
end

owner, repo = ARGV[0].split("/", 2)
number = ARGV[1].to_i

result = PrUnresolvedThreadFetcher.call(owner:, repo:, number:)
puts JSON.pretty_generate(result.to_h)
